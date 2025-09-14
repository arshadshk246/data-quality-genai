"use client";

import React, { useState, useEffect } from "react";
import {
  Typography,
  Box,
  Card,
  CardHeader,
  CardContent,
  Collapse,
  IconButton,
  Chip,
  CircularProgress,
  FormControl,
  Select,
  MenuItem,
  SelectChangeEvent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoIcon from "@mui/icons-material/Info";
import WarningIcon from "@mui/icons-material/Warning";
import ErrorIcon from "@mui/icons-material/Error";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { styled } from "@mui/material/styles";
import { useRouter } from "next/navigation";

// Types
interface Rule {
  rule_id: string;
  rule: string;
  table_name: string;
  column_name: string;
  rule_category: "info" | "error" | "warning";
  sql_query: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const DEFAULT_TABLE = "conventional_power_plants_DE";

const ExpandMore = styled(
  ({
    expand,
    ...other
  }: {
    expand: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => {
    return <IconButton {...other} />;
  }
)(({ theme, expand }: { theme: any; expand: boolean }) => ({
  transform: !expand ? "rotate(0deg)" : "rotate(180deg)",
  transition: theme.transitions.create("transform", {
    duration: theme.transitions.duration.shortest,
  }),
}));


// DeleteConfirmationDialog Component
const DeleteConfirmationDialog = ({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>Delete Rule</DialogTitle>
    <DialogContent>
      Are you sure you want to delete this rule? This action cannot be undone.
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button onClick={onConfirm} color="error" variant="contained">
        Delete
      </Button>
    </DialogActions>
  </Dialog>
);

const RuleCard = ({
  rule,
  onDelete,
  onEdit,
}: {
  rule: Rule;
  onDelete: (ruleId: string) => void;
  onEdit: (columnName: string) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleExpandClick = () => setExpanded(!expanded);

  const handleDeleteClick = () => setDeleteDialogOpen(true);

    const handleEditClick = () => {
      if (onEdit) {
        onEdit(rule.column_name); 
      }
    };

  const handleDeleteConfirm = () => {
    onDelete(rule.rule_id);
    setDeleteDialogOpen(false);
  };

  const getCategoryIcon = (category: Rule["rule_category"]) => {
    switch (category) {
      case "info":
        return <InfoIcon fontSize="small" color="info" />;
      case "warning":
        return <WarningIcon fontSize="small" sx={{ color: "#FFA500" }} />;
      case "error":
        return <ErrorIcon fontSize="small" color="error" />;
      default:
        return undefined;
    }
  };

  const getCategoryColor = (category: Rule["rule_category"]) => {
    switch (category) {
      case "info":
        return "info";
      case "warning":
        return "warning";
      case "error":
        return "error";
      default:
        return "default";
    }
  };

  return (
    <>
      <Card sx={{ width: "100%", mb: 2 }}>
        <CardHeader
          title={
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Typography variant="h6">
                {rule.rule ? rule.rule.substring(0, 100) : "N/A"}
                {rule.rule && rule.rule.length > 100 ? "..." : ""}
              </Typography>
              <Chip
                icon={getCategoryIcon(rule.rule_category)}
                label={rule.rule_category}
                color={getCategoryColor(rule.rule_category)}
                size="small"
              />
            </Box>
          }
          action={
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <IconButton
                color="error"
                onClick={handleEditClick}
                sx={{ mr: 1 }}
                aria-label="edit rule"
              >
                <EditIcon />
              </IconButton>
              <IconButton
                color="error"
                onClick={handleDeleteClick}
                sx={{ mr: 1 }}
                aria-label="delete rule"
              >
                <DeleteIcon />
              </IconButton>
              <ExpandMore
                expand={expanded}
                onClick={handleExpandClick}
                aria-expanded={expanded}
                aria-label="show more"
              >
                <ExpandMoreIcon />
              </ExpandMore>
            </Box>
          }
        />
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Table: {rule.table_name}
            </Typography>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Column: {rule.column_name}
            </Typography>
            <Typography variant="body1" paragraph>
              Rule: {rule.rule}
            </Typography>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              SQL Query:
            </Typography>
            <Typography
              variant="body2"
              component="pre"
              sx={{
                fontFamily: "monospace",
                bgcolor: "grey.100",
                p: 2,
                borderRadius: 1,
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {rule.sql_query}
            </Typography>
          </CardContent>
        </Collapse>
      </Card>
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
};

const RuleManagementPage = () => {
  const router = useRouter();
  const [selectedTable, setSelectedTable] = useState<string>(DEFAULT_TABLE);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  

  const fetchRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/get_all_rules_of_table/?table_name=${selectedTable}`,
        { method: "GET" }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch rules: ${response.statusText}`);
      }

      const data = await response.json();
      setRules(Array.isArray(data.rules) ? data.rules : []);
    } catch (error) {
      console.error("Error fetching rules:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred while fetching rules"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, [selectedTable]);

  const handleTableChange = (event: SelectChangeEvent<string>) => {
    setSelectedTable(event.target.value);
  };

  const handleEditRule = (rule: Rule) => {
    const params = new URLSearchParams({
      tableName: rule.table_name,
      selectedColumn: rule.column_name,
    });
    router.push(`/rule_creation?${params.toString()}`);
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/delete_rule/`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rule_id: ruleId }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete rule");
      }

      await fetchRules(); 
    } catch (error) {
      console.error("Error deleting rule:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred while deleting the rule"
      );
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
      <Typography variant="h4" gutterBottom color="#333">
        Rule Management
      </Typography>

      <FormControl sx={{ mb: 4, minWidth: 300 }}>
        <Select
          value={selectedTable}
          onChange={handleTableChange}
          displayEmpty
          sx={{ bgcolor: "background.paper" }}
        >
          <MenuItem value={DEFAULT_TABLE}>{DEFAULT_TABLE}</MenuItem>
          {/* Add more tables here or dynamically */}
        </Select>
      </FormControl>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Typography color="error" sx={{ mt: 2, mb: 2 }}>
          {error}
        </Typography>
      )}

      {!loading && !error && (
        <Box sx={{ mt: 2 }}>
          {rules.length === 0 ? (
            <Typography>No rules found for this table.</Typography>
          ) : (
            <>
              <Typography variant="subtitle1" sx={{ mb: 2 }} color="#333">
                Total Rules: {rules.length}
              </Typography>
              {rules.map((rule) => (
                <RuleCard
                  key={rule.rule_id || rule.rule + rule.column_name}
                  rule={rule}
                  onDelete={handleDeleteRule}
                  onEdit={() => handleEditRule(rule)} 
                />
              ))}
            </>
          )}
        </Box>
      )}
    </Box>
  );
};

export default RuleManagementPage;
