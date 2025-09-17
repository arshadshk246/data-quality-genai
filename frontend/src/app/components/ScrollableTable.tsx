import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Typography,
  Box,
  Button,
  useTheme,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

export interface ColumnInfo {
  name: string;
  description: string;
}

export interface DataRow {
  [key: string]: any;
}

export interface ScrollableTableProps {
  columns: ColumnInfo[];
  data: DataRow[];
  height?: number;
  selectedColumn: string | null;
  onSelectColumn: (colName: string) => void;
  validationResults?: {
    goodRows: number[];
    selectedColumn?: string | null;
  } | null;
}

const COLUMN_WIDTH = 140;
const VISIBLE_COLS = 5;

export function ScrollableTable({
  columns,
  data,
  height = 400,
  selectedColumn,
  onSelectColumn,
  validationResults,
}: ScrollableTableProps) {
  const theme = useTheme();
  const containerWidth = COLUMN_WIDTH * VISIBLE_COLS;

  return (
    <>
      <Paper
        sx={{
          maxHeight: height,
          width: containerWidth,
          overflow: "auto",
          p: 2,
          borderRadius: 3,
          boxShadow: theme.shadows[4],
          backgroundColor: theme.palette.background.paper,
        }}
        elevation={3}
      >
        <TableContainer
          sx={{ minWidth: COLUMN_WIDTH * columns.length, overflowX: "auto" }}
        >
          <Table stickyHeader size="small" aria-label="scrollable table">
            <TableHead>
              <TableRow sx={{ backgroundColor: "#1E88E5" }}>
                {columns.map((col) => (
                  <TableCell
                    key={col.name}
                    sx={{
                      minWidth: COLUMN_WIDTH,
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      color:
                        selectedColumn === col.name
                          ? "#fff"
                          : theme.palette.primary.main,
                      borderBottom: `2px solid ${theme.palette.divider}`,
                      cursor: "pointer",
                      transition: "color 0.3s ease",
                      bgcolor: selectedColumn === col.name ? "inherit" : "#fff",
                      "&:hover": {
                        color: "#ffff",
                        bgcolor: theme.palette.action.hover,
                      },
                    }}
                    onClick={() => onSelectColumn(col.name)}
                  >
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                    >
                      <Typography
                        variant="subtitle2"
                        component="span"
                        sx={{ fontWeight: "inherit" }}
                      >
                        {col.name}
                      </Typography>
                      <Tooltip title={col.description} arrow>
                        <InfoOutlinedIcon
                          fontSize="small"
                          sx={{
                            cursor: "pointer",
                            color:
                              selectedColumn === col.name
                                ? "#ffff"
                                : theme.palette.primary.main,
                          }}
                        />
                      </Tooltip>
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row, idx) => (
                <TableRow
                  key={idx}
                  hover
                  sx={{
                    backgroundColor:
                      idx % 2 === 0
                        ? theme.palette.background.paper
                        : theme.palette.action.hover,
                    transition: "background-color 0.3s ease",
                  }}
                >
                  {columns.map((col) => {
                    const isValidatedColumn =
                      validationResults?.selectedColumn === col.name;
                    const isValidRow =
                      isValidatedColumn &&
                      validationResults?.goodRows.includes(idx + 1);

                    return (
                      <TableCell
                        key={col.name}
                        sx={{
                          fontSize: 14,
                          color: theme.palette.text.secondary,
                          fontWeight:
                            selectedColumn === col.name ? "bold" : "normal",
                          ...(isValidatedColumn && {
                            backgroundColor: isValidRow
                              ? "rgba(46, 125, 50, 0.1)" // Light green
                              : "rgba(211, 47, 47, 0.1)", // Light red
                            color: isValidRow
                              ? "#2e7d32" // Dark green
                              : "#d32f2f", // Dark red
                          }),
                        }}
                      >
                        {row[col.name] ?? "-"}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </>
  );
}
