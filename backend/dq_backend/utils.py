import ast
import os
import sqlite3
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Annotated, List, Literal, Tuple, TypedDict

import pandas as pd
from dotenv import load_dotenv
from langchain_community.agent_toolkits import SQLDatabaseToolkit
from langchain_community.utilities.sql_database import SQLDatabase
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_core.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.pool import StaticPool

from .prompts import (check_query_system_prompt,
                      col_know_all_prompt_with_rules,
                      generate_query_system_prompt, suggest_rule_prompt)

# ------------------------------------------ setup ----------------------------------------------

checkpointer = MemorySaver()
load_dotenv()

DATABASE_NAME = "sample_mdm_db"
SOURCE_TABLE_NAME = "meter_data"
RULE_STORAGE_TABLE = "rule_storage"
RULE_RESULT_TABLE = "result_table"

# Get the absolute path of the folder where utils.py lives
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Go one level up (because utils.py is inside dq_backend)
PROJECT_ROOT = os.path.dirname(BASE_DIR)
# Build paths relative to project root
DATA_BASE_PATH_SOURCE = os.path.join(PROJECT_ROOT, "data", "source_data")
DB_PATH_SOURCE = os.path.join(DATA_BASE_PATH_SOURCE, "sample_mdm_db", "sample_mdm_db.sqlite")  # table name = meter_data

DATA_BASE_PATH_RULES = os.path.join(PROJECT_ROOT, "data", "rules")
DB_PATH_RULES = os.path.join(DATA_BASE_PATH_RULES, "rule_management.sqlite")

DATA_BASE_PATH_RESULT = os.path.join(PROJECT_ROOT, "data", "result")
DB_PATH_RESULT = os.path.join(DATA_BASE_PATH_RESULT, "result_db", "result_db.sqlite")


# Load database
def load_database(db_path=DATA_BASE_PATH_SOURCE) -> Engine:
    """Engine for opsd data."""
    return create_engine(f"sqlite:///{db_path}", poolclass=StaticPool)

# Get llm
def get_llm():
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash")
    return llm

# Get db
def get_db(db_path):
    engine = create_engine(f"sqlite:///{db_path}", poolclass=StaticPool)
    db = SQLDatabase(engine)
    return db

llm = get_llm()
db_source = get_db(DB_PATH_SOURCE)
db_rules = get_db(DB_PATH_RULES)
db_result = get_db(DB_PATH_RESULT)

# --------------------------------------- general utils ----------------------------------------------

# Get schema of a table
def get_schema_of_table(table, db, llm):

    toolkit = SQLDatabaseToolkit(db=db, llm=llm)
    tools = toolkit.get_tools()
    tools = tools
    
    get_schema_tool = next(tool for tool in tools if tool.name == "sql_db_schema")
    schema_call = {
    "name": "sql_db_schema",
    "args": {"table_names": table.strip()},
    "id": f"schema_{table.strip()}",
    "type": "tool_call",
    }
    schema_message = get_schema_tool.invoke(schema_call)
    schema = schema_message.content
    return schema

# Delete a table
def delete_table(table_name: str):
    """Delete (drop) a table from the database."""
    engine = load_database()
    with engine.connect() as conn:
        conn.execute(text(f"DROP TABLE IF EXISTS {table_name}"))
        conn.commit()
        print(f"Table '{table_name}' deleted successfully (if it existed).")

# Get sql tools
def get_sql_tools(db,llm):
    toolkit = SQLDatabaseToolkit(db=db, llm=llm)
    tools = toolkit.get_tools()
    tools = tools
    return tools

# Get tables from database
def list_tables(db,llm):
    tool_call = {
    "name": "sql_db_list_tables",
    "args": {},
    "id": "abc123",
    "type": "tool_call",
    }
    tools = get_sql_tools(db,llm)
    list_tables_tool = next(tool for tool in tools if tool.name == "sql_db_list_tables")
    tool_message = list_tables_tool.invoke(tool_call)
    return tool_message.content

# Get stats for query testing/validation on a column
def get_query_test_results(query: str, column_name, table_name):
    results = db_source.run(query)
    results = ast.literal_eval(results)
    list_good_rows = [row[0] for row in results]
    
    query_to_get_total_rows = f"SELECT COUNT(*) AS row_count FROM {table_name};"
    result = db_source.run(query_to_get_total_rows)
    if result:
        result = ast.literal_eval(result)
        total_rows = result[0][0]
        percentage_good_rows = (len(list_good_rows)*100)/total_rows
    else:
        total_rows = None
        percentage_good_rows = None

    return {
        "total_rows":total_rows,
        "total_good_rows":len(list_good_rows),
        "percentage_good_rows":percentage_good_rows,
        "list_good_rows":list_good_rows,
    }

# Run query
def run_query(query: str, db_path=DATA_BASE_PATH_SOURCE):
    engine = load_database(db_path)
    with engine.connect() as conn:
        result = conn.execute(text(query))
        return result.fetchall()

# Insert rule in the rules storage table
def insert_rule(rule, table_name, column_name, rule_category, sql_query_usr, sql_query_val):
    query = f"""
        INSERT INTO rule_storage (rule, table_name, column_name, rule_category, sql_query_usr, sql_query_val)
        VALUES ('{rule}', '{table_name}', '{column_name}', '{rule_category}', '{sql_query_usr}', '{sql_query_val}');
    """
    db_rules.run(query)
    print(f"✅ Rule inserted successfully.")

# Get top values from a column
def get_top_values(table_name: str, column_name: str, db_path=DATA_BASE_PATH_SOURCE, limit: int = 200):
    query = f"""
        SELECT {column_name}, COUNT(*) AS value_count
        FROM {table_name}
        GROUP BY {column_name}
        ORDER BY value_count DESC
        LIMIT {limit};
    """
    return run_query(query, db_path)

# Delete rule from the rules storage table
def delete_rule(rule_id):
    query = f"DELETE FROM rule_storage WHERE rule_id = {int(rule_id)}"
    db_rules.run(query)
    print(f"✅ Rule {rule_id} deleted successfully (if it existed).")

# Get existing rules on a column
def get_existing_rules_on_column(column_name, table_name):
    query = f"SELECT rule FROM rule_storage WHERE column_name = '{column_name}' AND table_name = '{table_name}'"
    results = db_rules.run(query)
    if not results:
        return []
    results = ast.literal_eval(results)
    flat_list = [r[0] for r in results]
    return flat_list

# Get all rules for a table
def get_all_rules_of_table(table_name, column_name=None):
    predicate=''
    if column_name:
        predicate = f"AND column_name = '{column_name}'"

    query = f"SELECT rule_id, rule, table_name, column_name, rule_category, sql_query_usr FROM rule_storage WHERE table_name = '{table_name}' {predicate}"
    results = db_rules.run(query)
    if not results:
        return []
    results = ast.literal_eval(results)
    keys = ["rule_id","rule", "table_name", "column_name", "rule_category", "sql_query_usr"]
    # convert each tuple into a dictionary
    dict_list = [dict(zip(keys, row)) for row in results]

    return dict_list

# load table and its values - chunk by chunk
def load_table_values(table_name, offset, limit):
    query = f"""
    SELECT * 
    FROM {table_name} 
    LIMIT {limit} OFFSET {offset}
    """
    results = db_source.run(query)  # returns list of tuples
    if not results:
        return None, None
    results = ast.literal_eval(results)
    
    columns_query = f"PRAGMA table_info({table_name})"  # For SQLite, get column names
    column_result = db_source.run(columns_query)
    if not column_result:
        return None, None
    column_result = ast.literal_eval(column_result)
    columns = [col[1] for col in column_result]
    
    # Convert to list of dicts
    data = [dict(zip(columns, row)) for row in results]
    return columns, data

# load column and values
def load_col_values(table_name, column_name, offset, limit):
    query = f"""
        SELECT {column_name}
        FROM {table_name}
        LIMIT {limit} OFFSET {offset}
    """
    results = db_source.run(query)
    if not results:
        return None
    
    results = ast.literal_eval(results)
    values_dict = {}
    for i, row in enumerate(results):
        values_dict[offset + i + 1] = row[0]
    
    return values_dict

# converts the user output query to validation query
def transform_query(query: str) -> str:
    splitted_query = query.strip().split("FROM")
    after_from = splitted_query[1]
    
    # Replace everything before FROM with 'select row_num '
    new_query = f"select row_num FROM {after_from.strip()}"
    return new_query

#
def get_total_rows(table_name):
    # total count
    query = f"SELECT COUNT(*) AS total_count FROM {table_name};"
    result = db_source.run(query)
    result = ast.literal_eval(result)
    total_rows = result[0][0]

    return total_rows

# get info on the column
def get_info(table_name, column_name):
    # total count
    query = f"SELECT COUNT(*) AS total_count FROM {table_name};"
    result = db_source.run(query)
    result = ast.literal_eval(result)
    total_rows = result[0][0]
    # total unique count
    query = f"SELECT COUNT(DISTINCT {column_name}) AS unique_count FROM {table_name} WHERE {column_name} IS NOT NULL;"
    result = db_source.run(query)
    result = ast.literal_eval(result)
    total_unique_values = result[0][0]
    # total null values
    query = f"SELECT COUNT(*) AS null_count FROM {table_name} WHERE {column_name} IS NULL;"
    result = db_source.run(query)
    result = ast.literal_eval(result)
    total_null_values = result[0][0]

    return total_rows, total_unique_values, total_null_values




# ------------------------------------------ agents and llm calls ---------------------------------------------------

# Agent - Tells stuff on the column and helps to create rules
def know_all_agent():

    # llm bind with tools
    tools = get_sql_tools(db_source,llm)
    llm_with_tools = llm.bind_tools(tools)

    # Define class
    class ChatState(TypedDict):
        messages: Annotated[list[BaseMessage], add_messages]
        current_column: str

    # Nodes
    def chat_node(state: ChatState):
        
        prompt_template = PromptTemplate(input_variables=["current_column"], template=col_know_all_prompt_with_rules)
        system_prompt = prompt_template.format(current_column=state["current_column"])
        system_message = SystemMessage(content=system_prompt)
        messages = [system_message] + state["messages"]

        response = llm_with_tools.invoke(messages)

        return {"messages": [response]}

    tool_node = ToolNode(tools)

    # Graph
    # - Nodes
    graph = StateGraph(ChatState)
    graph.add_node("chat_node", chat_node)
    graph.add_node("tools", tool_node)
    # - Edges
    graph.add_edge(START, "chat_node")
    graph.add_conditional_edges("chat_node",tools_condition)
    graph.add_edge('tools', 'chat_node')
    # - Compile
    chatbot = graph.compile(checkpointer=checkpointer)

    return chatbot

# Agent - Rule to SQL conversion agent
def rule_to_sql_agent(llm, db, checkpointer, table_name, schema, column_name, generate_query_system_prompt, check_query_system_prompt):

    # Tools
    toolkit = SQLDatabaseToolkit(db=db, llm=llm)
    tools = toolkit.get_tools()
    tools = tools

    run_query_tool = next(tool for tool in tools if tool.name == "sql_db_query")
    run_query_node = ToolNode([run_query_tool], name="run_query")

    def generate_query(state: MessagesState):
        prompt_template = PromptTemplate(input_variables=["dialect", "schema", "table_name", "column_name"], template=generate_query_system_prompt)
        system_prompt = prompt_template.format(dialect=db.dialect, schema=schema, table_name=table_name, column_name=column_name)
        system_message = SystemMessage(content=system_prompt)

        llm_with_tools = llm.bind_tools([run_query_tool])
        response = llm_with_tools.invoke([system_message] + state["messages"])
        return {"messages": [response]}

    def check_query(state: MessagesState):
        prompt_template = PromptTemplate(input_variables=["dialect"], template=check_query_system_prompt)
        system_prompt = prompt_template.format(dialect=db.dialect)
        system_message = SystemMessage(content=system_prompt)
        
        # Last message contains the generated query
        tool_call = state["messages"][-1].tool_calls[0]
        user_message = {"role": "user", "content": tool_call["args"]["query"]}
        
        llm_with_tools = llm.bind_tools([run_query_tool], tool_choice="any")
        response = llm_with_tools.invoke([system_message, user_message])
        response.id = state["messages"][-1].id
        return {"messages": [response]}

    def should_continue(state: MessagesState) -> Literal[END, "check_query"]:
        last_message = state["messages"][-1]
        return END if not last_message.tool_calls else "check_query"

    # --- 3. Build agent graph ---
    builder = StateGraph(MessagesState)
    builder.add_node(generate_query)
    builder.add_node(check_query)
    builder.add_node(run_query_node, "run_query")

    builder.add_edge(START, "generate_query")
    builder.add_conditional_edges("generate_query", should_continue)
    builder.add_edge("check_query", "run_query")
    builder.add_edge("run_query", "generate_query")

    agent = builder.compile(checkpointer=checkpointer)
    return agent

# llm call - Get data quality rule for a specific column
def get_rule_suggestion_on_column(column_name, table_name, existing_rules):

    llm = get_llm()
    db = get_db(DB_PATH_SOURCE)
    schema = get_schema_of_table(table_name, db, llm)
    values = get_top_values(table_name, column_name, db_path=DB_PATH_SOURCE, limit=200)
    existing_rules = get_existing_rules_on_column(column_name, table_name)
    prompt_template = PromptTemplate(input_variables=["existing_rules","column","table_name","schema","values"], template=suggest_rule_prompt)
    system_prompt = prompt_template.format(existing_rules=existing_rules, column=column_name, table_name=table_name, schema=schema, values=values)
    system_message = SystemMessage(content=system_prompt)
    user_message = HumanMessage(content=f"Please suggest a data quality rule for this column - {column_name}.")
    response = llm.invoke([system_message, user_message])
    response = response.content.strip()
    # Clean up and enforce the exact format
    if "rule:" in response.lower():
        rule_text = response
        return rule_text
    else:
        return None

def get_rule_from_response(llm, get_rule_out_prompt, response):
    system_message = SystemMessage(content=get_rule_out_prompt)
    rule = llm.invoke([system_message]+[response])
    return rule.content.strip()

# ---------------------------------------- process agent outputs ----------------------------------------------

def convert_rule_to_sql(rule, table_name, column_name):

    llm = get_llm()
    db = get_db(DB_PATH_SOURCE)
    schema = get_schema_of_table(table_name, db, llm)
    agent = rule_to_sql_agent(llm, db, checkpointer, table_name, schema, column_name, generate_query_system_prompt, check_query_system_prompt)
    user_input = rule
    query_ready = True

    response = agent.invoke({
        "messages": [HumanMessage(content=user_input)],
    }, config={"configurable": {"thread_id": "thread_id-1"}})

    result = response["messages"][-1].content

    # Need something from user to break the loop, like an approval
    if "query:" in result.lower():
        query = result.split(":")[-1].strip()
        output = query
    elif "question" in result.lower():
        question = result.split(":")[-1].strip()
        output = question
        query_ready = False
    print(query_ready, output)
    return query_ready, output

chatbot = know_all_agent()

def call_know_all_agent():
    
    response = chatbot.invoke({"messages":[HumanMessage(content=user_input)],"current_column":"postcode"},
                    config={"configurable":{"thread_id":"thread_id-1"}})
    return response["messages"][-1].content


# ---------------------------------------- ETL utils ----------------------------------------------
def create_connection(db_path):
    conn = sqlite3.connect(db_path)
    # Create a cursor object to execute SQL commands
    cursor = conn.cursor()
    print(f"Connection created with provided database")
    return cursor, conn


def close_connection(conn):
    # Close the connection
    conn.close()
    print(f"Connection to database is closed")


def execute_query(cur, query_string):
    cur.execute(query_string)
    result = cur.fetchall()
    return result


def get_sql_queries_for_rules(rule_id_list: list) -> list:
    predicate = ""
    if rule_id_list:
        rule_str = ", ".join(f"'{rule_num}'" for rule_num in rule_id_list)
        predicate = f"WHERE rule_id in ({rule_str})"

    sql_query = f"SELECT rule_id, rule_category, sql_query_val FROM {RULE_STORAGE_TABLE} {predicate}"

    raw_result = db_rules._execute(sql_query)
    rule_val_query_list = [tuple(row.values()) for row in raw_result]
    return rule_val_query_list


def process_single_rule_sqlite(
    rule_number: int, log_level: str, rule_val_query: str
) -> List[Tuple]:
    """
    Return rows from the source_table that are NOT included in the rule_val_query, with row numbers.

    Args:
        db_path (str): Path to the SQLite database file.
        rule_number (int): Identifier for the rule being processed.
        rule_val_query (str): SQL validation query generated for the natural language rule on source_table.

    Returns:
        List of tuples: Each tuple represents a row (with a row number) not returned by the rule_val_query.
    """
    try:

        # Ensure rule_val_query selects row_num column from source table

        query = (
            f"WITH filtered_rows AS ("
            f" {rule_val_query})"
            f" SELECT ns.row_num "
            f" FROM {SOURCE_TABLE_NAME} ns"
            f" LEFT JOIN filtered_rows fr ON ns.row_num = fr.row_num"
            f" WHERE fr.row_num IS NULL;"
        )

        raw_result = db_source._execute(query)
        failing_row_numbers = [row["row_num"] for row in raw_result]

        return (rule_number, failing_row_numbers, log_level)

    except Exception as e:
        print(f"Error in processing rule number {rule_number}:\n{e}")
        return rule_number, [], log_level


def process_table_rules_parallel(rule_queries):
    """
    Executes all rules in parallel on SQLite DB and returns:
    - final_df: Combined result of all queries
    - failed_df: Full table A with failed_rules column
    """
    results = {}

    with ThreadPoolExecutor() as executor:
        futures = [
            executor.submit(
                process_single_rule_sqlite,
                rule_number=rule_num,
                log_level=log_level,
                rule_val_query=sql,
            )
            for rule_num, log_level, sql in rule_queries
        ]

        for future in as_completed(futures):
            rule_number, result_df, log_level = future.result()
            results[rule_number] = (log_level, result_df)

    return results


def add_passed_rules_column(df):
    # Clean up whitespace and empty strings
    df = df.fillna("").applymap(lambda x: x.strip() if isinstance(x, str) else x)

    col_list = ["info", "warning", "error"]  # whatever your rule columns are
    col_list = [col for col in col_list if col in df.columns.tolist()]

    # Set to collect all unique rule numbers
    all_rules = set()

    for col in col_list:
        for val in df[col]:
            if pd.notnull(val):
                val_str = str(val)
                all_rules.update(r.strip() for r in val_str.split(",") if r.strip())

    # Convert to sorted list for consistency
    all_rules = sorted(all_rules)

    # Define function to get passed rules for a row
    def get_passed_rules(row):
        used_rules = set()

        for col in col_list:
            val = row.get(col, "")
            if pd.notnull(val):
                val_str = str(val)
                used_rules.update(r.strip() for r in val_str.split(",") if r.strip())

        passed = [r for r in all_rules if r not in used_rules]
        return ", ".join(passed)

    # Add 'passed_rules' column
    df["passed_rules"] = df.apply(get_passed_rules, axis=1)

    return df


def save_result_table_to_db(df):
    _, conn = create_connection(DB_PATH_RESULT)
    df.to_sql(RULE_RESULT_TABLE, conn, if_exists="replace", index=False)
    close_connection(conn)


def process_and_save_rule_results(result):
    try:
        _, conn = create_connection(DB_PATH_SOURCE)
        query_string = f"SELECT * FROM {SOURCE_TABLE_NAME}"
        # df = execute_query(cur, query_string)
        df = pd.read_sql(query_string, conn)

        # Update index to start from 1
        df.index = range(1, len(df) + 1)

        # Identify all unique categories
        categories = set(cat for cat, _ in result.values())

        # Initialize empty columns for each category
        for category in categories:
            df[category] = ""

        # For each rule, add rule name to relevant category column for failed rows
        for rule, (category, rows) in result.items():
            for row in rows:
                current = df.at[row, category]
                df.at[row, category] = f"{current}, {rule}"

        # Clean up spacing
        df = df.applymap(lambda x: x.strip(", ").strip() if isinstance(x, str) else x)

        df = add_passed_rules_column(df)

        column_to_be_renamed = [
            col for col in ["info", "warning", "error"] if col in df.columns.tolist()
        ]
        columns_replaced_with = [f"failed_{col}_rules" for col in column_to_be_renamed]
        df = df.rename(columns=dict(zip(column_to_be_renamed, columns_replaced_with)))

        # Save to result DB
        print("Saving results in database...")
        save_result_table_to_db(df)

    except Exception as e:
        print(f"Error in updating result table:\n{e}")
    finally:
        close_connection(conn)


# Get rule result table
def get_rule_result_table():
    query = f"SELECT * FROM {RULE_RESULT_TABLE}"
    results = db_result.run(query)  # returns list of tuples
    if not results:
        return []
    results = ast.literal_eval(results)

    columns_query = (
        f"PRAGMA table_info({RULE_RESULT_TABLE})"  # For SQLite, get column names
    )
    column_result = db_result.run(columns_query)

    if not column_result:
        return None, None

    column_result = ast.literal_eval(column_result)
    columns = [col[1] for col in column_result]

    # Convert to list of dicts
    data = [dict(zip(columns, row)) for row in results]
    return data