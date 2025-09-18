"use client";

import React, { useState } from "react";
import {
  Typography,
  Fade,
  Paper,
  TextField,
  Button,
  Box,
  LinearProgress,
  Tooltip,
  IconButton,
  useTheme,
  Skeleton,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { ScrollableTable, ColumnInfo, DataRow } from "./ScrollableTable";
import ChatButton from "./ChatButton";
import ChatWindow from "./ChatWindow";

import { useRouter, useSearchParams } from "next/navigation";

export default function RuleCreationPage() {
  const router = useRouter();
  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const theme = useTheme();

  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [tableData, setTableData] = useState<DataRow[]>([]);

  const searchParams = useSearchParams();
  const defaultSelectedColumn = searchParams.get("selectedColumn") || null;
  const defaultTableName = searchParams.get("tableName") || "meter_data";

  const fetchTableData = async () => {
    setTableName("meter_data");

    try {
      const response = await fetch(`${API_BASE_URL}/get_table_data/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          table_name: tableName,
          offset: 0,
          limit: 50,
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch table data");

      const result = await response.json();

      // Transform columns data to match ColumnInfo interface
      const columnInfos: ColumnInfo[] = result.columns.map((col: string) => ({
        name: col,
        description: `Column: ${col}`, // You can enhance this with more column metadata
      }));

      setColumns(columnInfos);
      setTableData(result.rows);
    } catch (error) {}
  };

  const [selectedColumn, setSelectedColumn] = useState<string | null>(
    defaultSelectedColumn
  );
  const [generatedRule, setGeneratedRule] = useState<string>("");
  const [sqlQuery, setSqlQuery] = useState<string>("");
  const [passPercent, setPassPercent] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [sqlLoading, setSqlLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [tableName, setTableName] = useState<string>(defaultTableName);
  const [selectedCategory, setSelectedCategory] = useState<
    "error" | "info" | "warning" | null
  >(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [validationResults, setValidationResults] = useState<{
    goodRows: number[];
    selectedColumn: string | null;
  } | null>(null);
  const [sql_query_val, setSql_query_val] = useState<string>("")

  // Fetch table data when component mounts
  React.useEffect(() => {
    fetchTableData();
  }, [tableName]);

  const handleRuleSelect = (rule: string) => {
    setGeneratedRule(rule);
  };

  const askAI = async () => {
    if (!selectedColumn) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/get_rule_suggestion/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          table_name: tableName,
          column_name: selectedColumn,
          existing_rules: [generatedRule],
        }),
      });

      if (!response.ok) throw new Error("API request failed");

      const data = await response.json();
      const rule = data.suggested_rule.replace(/^RULE:\s*/, "");
      setGeneratedRule(rule);
    } catch (error) {
      setGeneratedRule("Error generating rule.");
      setSqlQuery("");
    } finally {
      setLoading(false);
    }
  };

  const validateRule = async () => {
    if (!generatedRule.trim() || !selectedColumn) {
      setPassPercent(0);
      return;
    }
    const selectRegex = /^SELECT\s+.*?\s+FROM\s+/is;
    const sql_val = sqlQuery.replace(selectRegex, "SELECT row_num FROM ");
    setSql_query_val(sql_val);

    try {
      const response = await fetch(`${API_BASE_URL}/validate_sql_query/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sql_query: sql_query_val,
          table_name: tableName,
          column_name: selectedColumn,
        }),
      });
      console.log(`Validate button clicked ${sql_query_val}`);
      
      if (!response.ok) throw new Error("API request failed");

      const data = await response.json();
      console.log(data);
      
      const stats = data?.stats;
      if (!stats) throw new Error("No stats in response");

      const passRate = stats.percentage_good_rows;
      setPassPercent(passRate);

      // Store validation results for table highlighting
      setValidationResults({
        goodRows: stats.list_good_rows || [],
        selectedColumn: selectedColumn,
      });
    } catch (error) {
      setPassPercent(0);
    }
  };

  const convertToSQL = async () => {
    if (!generatedRule.trim()) {
      setSqlQuery("");
      return;
    }

    setSqlLoading(true);
    try {
      console.log(tableName, selectedColumn, generatedRule);
      
      const response = await fetch(`${API_BASE_URL}/convert_rule_to_sql/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          table_name: tableName,
          column_name: selectedColumn,
          rule: generatedRule,
        }),
      });

      if (!response.ok) throw new Error("API request failed");
      const data = await response.json();
      console.log(data);

      if (data.sql_output[0] == true) {
        console.log(data.sql_output[0]);
        setSqlQuery(data.sql_output[1]);
      } else {
        setSqlQuery("The rule could not be converted to SQL.");
      }
    } catch (error) {
      setSqlQuery("Error converting rule to SQL.");
    } finally {
      setSqlLoading(false);
    }
  };

  const submitRule = async () => {
    if (
      !selectedColumn ||
      !generatedRule.trim() ||
      !sqlQuery.trim() ||
      !selectedCategory
    ) {
      return;
    }

    setSubmitLoading(true);
    console.log(sqlQuery);
    

    
    try {
      const response = await fetch(`${API_BASE_URL}/add_rule/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rule: generatedRule,
          table_name: tableName,
          column_name: selectedColumn,
          rule_category: selectedCategory,
          sql_query_usr: sqlQuery,
          sql_query_val: sql_query_val
        }),
      });

      console.log(
        generatedRule,
        tableName,
        selectedColumn,
        selectedCategory,
        sqlQuery,
        sql_query_val
      );
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error("Server response:", errorData);
        throw new Error(
          `Failed to add rule: ${response.status} ${response.statusText}. ${errorData}`
        );
      }

      const responseData = await response.json();

      // Reset the category selection after successful submission
      setSelectedCategory(null);
      alert("Rule added successfully!"); // Add user feedback
    } catch (error) {
      console.error("Error submitting rule:", error);
      console.error("Request details:", {
        url: `${API_BASE_URL}/add_rule/`,
        method: "PUT",
        data: {
          rule: generatedRule,
          table_name: tableName,
          column_name: selectedColumn,
          rule_category: selectedCategory,
          sql_query: sqlQuery,
        },
      });
      alert("Failed to add rule. Please check the console for details."); // Add user feedback
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleClick = () => {
    router.push("/rule_management");
  };

  return (
    <div className="flex h-screen w-screen relative">
      <ChatButton
        isOpen={isChatOpen}
        onClick={() => setIsChatOpen(!isChatOpen)}
      />
      <ChatWindow
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        tableName={tableName}
        selectedColumn={selectedColumn}
        onRuleSelect={handleRuleSelect}
      />

      {/* Left Columns Table */}
      <div className="p-6 border-r border-gray-300 bg-white w-[750px]">
        <div className="flex items-center justify-between mb-4">
          <Typography variant="h6" fontWeight="bold" color="text.primary">
            Table: {tableName}
          </Typography>
          <Button variant="contained" onClick={handleClick}>
            Rule Management
          </Button>
        </div>
        <ScrollableTable
          columns={columns}
          data={tableData}
          height={600}
          selectedColumn={selectedColumn}
          onSelectColumn={setSelectedColumn}
          validationResults={validationResults}
        />
      </div>

      {/* Right Rule Creation Area */}
      <main className="flex-1 p-8 bg-gray-50 flex flex-col max-w-100">
        {selectedColumn ? (
          <Fade in={true}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <Typography variant="h6" fontWeight="bold" color="text.primary">
                Rule creation for:{" "}
                <Box component="span" color={theme.palette.primary.main}>
                  {selectedColumn}
                </Box>
              </Typography>

              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 1,
                  bgcolor: theme.palette.background.paper,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 1,
                  }}
                >
                  <Typography variant="subtitle2" color="textSecondary">
                    Type or Generate Rule
                  </Typography>
                  <Tooltip title="Ask AI" arrow>
                    <IconButton
                      color="primary"
                      onClick={askAI}
                      disabled={loading}
                      size="medium"
                    >
                      <AutoAwesomeIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                </Box>
                {loading ? (
                  <Skeleton
                    variant="rectangular"
                    width="100%"
                    height={80}
                    sx={{ bgcolor: "rgba(0, 0, 0, 0.1)" }}
                  />
                ) : (
                  <TextField
                    multiline
                    rows={3}
                    fullWidth
                    variant="standard"
                    value={generatedRule}
                    onChange={(e) => setGeneratedRule(e.target.value)}
                    placeholder="Type your rule here or click the AI icon to generate one..."
                    InputProps={{
                      disableUnderline: true,
                      sx: {
                        fontFamily: "monospace",
                        fontSize: "0.9rem",
                        "& textarea": {
                          padding: 1,
                        },
                      },
                    }}
                    autoFocus
                  />
                )}
              </Paper>
              <Button
                variant="contained"
                color="success"
                onClick={convertToSQL}
                disabled={!generatedRule.trim()}
              >
                Convert to SQL
              </Button>

              {/* SQL query display */}
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  minHeight: 80,
                  fontFamily: "monospace",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "break-word",
                  bgcolor: theme.palette.background.paper,
                  color: theme.palette.text.primary,
                  borderRadius: 1,
                  borderColor: theme.palette.divider,
                  userSelect: "text",
                }}
              >
                {sqlLoading ? (
                  <Box sx={{ width: "100%" }}>
                    <Skeleton animation="wave" height={20} sx={{ mb: 1 }} />
                    <Skeleton animation="wave" height={20} sx={{ mb: 1 }} />
                    <Skeleton animation="wave" height={20} />
                  </Box>
                ) : (
                  sqlQuery
                )}
              </Paper>

              {/* Validate button */}
              <Button
                variant="contained"
                color="success"
                onClick={validateRule}
              >
                Validate
              </Button>

              {/* Pass rate progress bar */}
              <Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Pass Rate: {passPercent}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={passPercent}
                  sx={{
                    height: 12,
                    borderRadius: 6,
                    bgcolor: theme.palette.grey[300],
                    "& .MuiLinearProgress-bar": {
                      borderRadius: 6,
                      bgcolor: theme.palette.success.main,
                    },
                  }}
                />
              </Box>

              {/* Only show validation section when valid SQL query exists */}
              {sqlQuery &&
                sqlQuery !== "The rule could not be converted to SQL." && (
                  <>
                    <div className="flex justify-between">
                      {/* Error button */}
                      <Button
                        variant={
                          selectedCategory === "error"
                            ? "outlined"
                            : "contained"
                        }
                        color="error"
                        onClick={() => setSelectedCategory("error")}
                        sx={{
                          borderColor:
                            selectedCategory === "error"
                              ? "error.main"
                              : "transparent",
                        }}
                      >
                        Error
                      </Button>
                      {/* Info button */}
                      <Button
                        variant={
                          selectedCategory === "info" ? "outlined" : "contained"
                        }
                        color="info"
                        onClick={() => setSelectedCategory("info")}
                        sx={{
                          borderColor:
                            selectedCategory === "info"
                              ? "info.main"
                              : "transparent",
                        }}
                      >
                        Info
                      </Button>
                      {/* Warning button */}
                      <Button
                        variant={
                          selectedCategory === "warning"
                            ? "outlined"
                            : "contained"
                        }
                        onClick={() => setSelectedCategory("warning")}
                        sx={{
                          backgroundColor:
                            selectedCategory === "warning"
                              ? "transparent"
                              : "#FFA500",
                          color: "black",
                          "&:hover": { backgroundColor: "#ffb733" },
                          borderColor:
                            selectedCategory === "warning"
                              ? "#FFA500"
                              : "transparent",
                          border:
                            selectedCategory === "warning"
                              ? "1px solid"
                              : "none",
                        }}
                      >
                        Warning
                      </Button>
                    </div>

                    {/* Submit Button - Only shown when a category is selected */}
                    {selectedCategory && (
                      <Button
                        variant="contained"
                        color="primary"
                        fullWidth
                        onClick={submitRule}
                        disabled={
                          !generatedRule.trim() ||
                          !sqlQuery.trim() ||
                          submitLoading
                        }
                      >
                        Submit Rule
                      </Button>
                    )}
                  </>
                )}
            </Box>
          </Fade>
        ) : (
          <Box sx={{ color: theme.palette.text.secondary }}>
            <Typography variant="h6" color="text.secondary">
              Select a column to create a rule.
            </Typography>
          </Box>
        )}
      </main>
    </div>
  );
}
