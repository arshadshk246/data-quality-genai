from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from utils import (
    convert_rule_to_sql, insert_rule, delete_rule,
    get_rule_suggestion_on_column, get_all_rules_of_table,
    get_query_test_results, load_table_values, load_col_values, transform_query, get_info, chatbot
)
from langchain_core.messages import HumanMessage

app = FastAPI(
    title="Data Quality Rule Management API",
    description="APIs to manage data quality rules, validate queries, fetch table/column data, and interact with an AI chatbot.",
    version="1.0.0"
)


class ConvertRuleRequest(BaseModel):
    table_name: str = Field(..., description="Name of the database table", example="meter_data")
    column_name: str = Field(..., description="Column on which the rule is applied", example="pincode")
    rule: str = Field(..., description="Rule text to be converted into SQL", example="there should not be a null value")


class AddRuleRequest(BaseModel):
    rule: str = Field(..., description="Rule text to be converted into SQL", example="there should not be a null value")
    table_name: str = Field(..., description="Name of the database table", example="meter_data")
    column_name: str = Field(..., description="Column on which the rule is applied", example="pincode")
    rule_category: str = Field(..., description="Category of rule (e.g., info, warning, error)", example="info")
    sql_query: str = Field(..., description="SQL representation of the rule", example="SELECT row_num FROM meter_data WHERE pincode IS NOT NULL")


class DeleteRuleRequest(BaseModel):
    rule_id: str = Field(..., description="Unique identifier of the rule to be deleted", example="123e4567-e89b-12d3-a456-426614174000")


class RuleSuggestionRequest(BaseModel):
    table_name: str = Field(..., description="Name of the database table", example="meter_data")
    column_name: str = Field(..., description="Column on which the rule is applied", example="pincode")
    existing_rules: Optional[List[str]] = Field(default=[], description="List of existing rules for the column", example=["must not be null", "must be unique"])


class TableDataRequest(BaseModel):
    table_name: str = Field(..., description="Name of the database table", example="meter_data")
    offset: int = Field(default=0, description="Row offset (for pagination)", example=0)
    limit: int = Field(default=100, description="Maximum number of rows to return", example=50)


class ColumnDataRequest(BaseModel):
    table_name: str = Field(..., description="Name of the database table", example="meter_data")
    column_name: str = Field(..., description="Column on which the rule is applied", example="pincode")
    offset: int = Field(default=0, description="Row offset (for pagination)", example=0)
    limit: int = Field(default=100, description="Maximum number of rows to return", example=50)


class ChatbotRequest(BaseModel):
    user_input: str = Field(..., description="User query or message to the AI chatbot", example="Suggest a rule for validating not null values")
    table_name: str = Field(..., description="Name of the database table", example="meter_data")
    column_name: str = Field(..., description="Column on which the rule is applied", example="pincode")


class ValidateSQLRequest(BaseModel):
    sql_query: str = Field(..., description="SQL representation of the rule", example="SELECT row_num FROM meter_data WHERE pincode IS NOT NULL")
    table_name: str = Field(..., description="Name of the database table", example="meter_data")
    column_name: str = Field(..., description="Column on which the rule is applied", example="pincode")

class InfoRequest(BaseModel):
    table_name: str = Field(..., description="Name of the database table", example="meter_data")
    column_name: str = Field(..., description="Column on which the rule is applied", example="pincode")


# API Endpoints

@app.post("/convert_rule_to_sql/")
def convert_rule_to_sql_api(request: ConvertRuleRequest):
    sql_output = convert_rule_to_sql(request.rule, request.table_name, request.column_name)
    return JSONResponse(content={"sql_output": sql_output})


@app.post("/validate_sql_query/")
def validate_sql_query(request: ValidateSQLRequest):
    validation_sql_query = transform_query(request.sql_query)
    stats_dict = get_query_test_results(validation_sql_query, request.column_name, request.table_name)
    return JSONResponse(content={"stats": stats_dict})


@app.put("/add_rule/")
def add_rule_api(request: AddRuleRequest):
    rule_id = str(uuid.uuid4())
    insert_rule(rule_id, request.rule, request.table_name,
                request.column_name, request.rule_category, request.sql_query)
    return JSONResponse(content={"message": f"Rule '{rule_id}' inserted successfully."})


@app.delete("/delete_rule/")
def delete_rule_api(request: DeleteRuleRequest):
    delete_rule(request.rule_id)
    return JSONResponse(content={"message": f"Rule '{request.rule_id}' deleted successfully (if it existed)."})


@app.post("/get_rule_suggestion/")
def get_rule_suggestion_api(request: RuleSuggestionRequest):
    suggested_rule = get_rule_suggestion_on_column(request.column_name, request.table_name, request.existing_rules)
    return JSONResponse(content={"suggested_rule": suggested_rule})


@app.get("/get_all_rules_of_table/")
def get_all_rules_of_table_api(table_name: str = Query(..., description="Table name", example="customers")):
    rules = get_all_rules_of_table(table_name)
    return JSONResponse(content={"rules": rules})


@app.post("/get_table_data/")
def get_table_data_api(request: TableDataRequest):
    columns, data = load_table_values(request.table_name, request.offset, request.limit)
    return JSONResponse(content={"columns": columns, "rows": data})


@app.post("/get_col_data/")
def get_col_data_api(request: ColumnDataRequest):
    data = load_col_values(request.table_name, request.column_name, request.offset, request.limit)
    return JSONResponse(content={"rows": data})


@app.post("/chatbot/")
def chatbot_api(request: ChatbotRequest):
    response = chatbot.invoke(
        {"messages": [HumanMessage(content=request.user_input)], "current_column": request.column_name},
        config={"configurable": {"thread_id": "thread_id-1"}}
    )
    return JSONResponse(content={"AI Response": response["messages"][-1].content})


@app.post("/info/")
def info_api(request: InfoRequest):
    info = get_info(request.table_name, request.column_name)
    return JSONResponse(content={"info": info})