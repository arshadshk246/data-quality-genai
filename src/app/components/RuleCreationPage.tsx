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
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { ScrollableTable, ColumnInfo, DataRow } from "./ScrollableTable";
import ChatButton from "./ChatButton";
import ChatWindow from "./ChatWindow";

export default function RuleCreationPage() {
  const theme = useTheme();

  const columns: ColumnInfo[] = [
    { name: "Column A", description: "Nulls: 10\nDistinct: 25" },
    { name: "Column B", description: "Nulls: 5\nDistinct: 40" },
    { name: "Column C", description: "Nulls: 0\nDistinct: 60" },
    { name: "Column D", description: "Nulls: 3\nDistinct: 15" },
    { name: "Column E", description: "Nulls: 7\nDistinct: 35" },
    { name: "Column F", description: "Nulls: 2\nDistinct: 45" },
  ];

  const data: DataRow[] = Array.from({ length: 20 }, (_, idx) => ({
    "Column A": `a-${idx}`,
    "Column B": `b-${idx}`,
    "Column C": `c-${idx}`,
    "Column D": `d-${idx}`,
    "Column E": `e-${idx}`,
    "Column F": `f-${idx}`,
  }));

  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [ruleText, setRuleText] = useState<string>("");
  const [sqlQuery, setSqlQuery] = useState<string>("");
  const [passPercent, setPassPercent] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const askAI = async () => {
    if (!selectedColumn || !ruleText.trim()) return;

    setLoading(true);
    try {
      const messages = [
        {
          role: "system",
          content: "You are an assistant generating SQL validation rules.",
        },
        {
          role: "user",
          content: `Create a SQL validation rule for the column ${selectedColumn}: ${ruleText}. Just Give most relevent sql query only do not give explanation`,
        },
      ];

      const API_BASE_URL =
        process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

      const response = await fetch(`${API_BASE_URL}/api/groq-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) throw new Error("API request failed");

      const data = await response.json();

      setSqlQuery(data.response);

    } catch (error) {
      setSqlQuery("Error fetching AI response.");
    } finally {
      setLoading(false);
    }
  };

  const validateRule = () => {
    if (!ruleText.trim() || !selectedColumn) {
      setSqlQuery("");
      setPassPercent(0);
      return;
    }
    const trimmedRule = ruleText.trim().toLowerCase();

    const matchingRows = data.filter((row) =>
      String(row[selectedColumn]).toLowerCase().includes(trimmedRule)
    );

    const passRate = Math.round((matchingRows.length / data.length) * 100);
    setPassPercent(passRate);
  };
  const [isChatOpen, setIsChatOpen] = useState(false);
  return (
    <div className="flex h-screen w-screen relative">
      <ChatButton
        isOpen={isChatOpen}
        onClick={() => setIsChatOpen(!isChatOpen)}
      />
      <ChatWindow isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

      {/* Left Columns Table */}
      <div className="p-6 border-r border-gray-300 bg-white w-[750px]">
        <Typography
          variant="h6"
          gutterBottom
          fontWeight="bold"
          color="text.primary"
        >
          Columns
        </Typography>
        <ScrollableTable
          columns={columns}
          data={data}
          height={600}
          selectedColumn={selectedColumn}
          onSelectColumn={setSelectedColumn}
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

              {/* Rule input with Ask AI tooltip button */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <TextField
                  label="Type rule here"
                  variant="outlined"
                  fullWidth
                  value={ruleText}
                  onChange={(e) => setRuleText(e.target.value)}
                  autoFocus
                />
                <Tooltip title="Ask AI" arrow>
                  <IconButton
                    color="primary"
                    onClick={askAI}
                    disabled={!ruleText.trim() || loading}
                    size="large"
                  >
                    <AutoAwesomeIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </Box>

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
                {loading
                  ? "Loading AI response..."
                  : sqlQuery || "Validated SQL query will appear here."}
              </Paper>
              <div className="flex justify-between">
                {/* Error button */}
                <Button
                  variant="contained"
                  color="error"
                  disabled={!ruleText.trim()}
                >
                  Error
                </Button>
                {/* Info button */}
                <Button
                  variant="contained"
                  color="info"
                  disabled={!ruleText.trim()}
                >
                  Info
                </Button>
                {/* Warn button */}
                <Button
                  variant="contained"
                  disabled={!ruleText.trim()}
                  sx={{
                    backgroundColor: "#FFA500",
                    color: "black",
                    "&:hover": { backgroundColor: "#ffb733" },
                  }}
                >
                  Warn
                </Button>
              </div>

              {/* Validate button */}
              <Button
                variant="contained"
                color="success"
                onClick={validateRule}
                disabled={!ruleText.trim()}
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
