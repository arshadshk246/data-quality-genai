"use client";

import React, { useState, useEffect } from "react";

interface ColumnInfo {
  name: string;
  nullCount: number;
  distinctCount: number;
}

interface Rule {
  text: string;
  sql: string;
  passRate: number;
}

const dummyColumns: ColumnInfo[] = [
  { name: "Column A", nullCount: 10, distinctCount: 25 },
  { name: "Column B", nullCount: 5, distinctCount: 40 },
  { name: "Column C", nullCount: 0, distinctCount: 60 },
];

export default function RuleCreationPage() {
  const [columns, setColumns] = useState<ColumnInfo[]>(dummyColumns);
  const [selectedColumn, setSelectedColumn] = useState<ColumnInfo | null>(null);
  const [ruleText, setRuleText] = useState<string>("");
  const [sqlQuery, setSqlQuery] = useState<string>("");
  const [passRate, setPassRate] = useState<number | null>(null);
  const [aiChatMessages, setAiChatMessages] = useState<string[]>([]);
  const [aiInput, setAiInput] = useState<string>("");

  // Mock Validate function converts ruleText to SQL and returns dummy pass rate
  const validateRule = () => {
    if (!ruleText.trim()) return;
    // Replace this with real API call to convert to SQL & get stats
    setSqlQuery(`SELECT * FROM table WHERE ${ruleText}`);
    setPassRate(Math.floor(Math.random() * 100));
  };

  // Mock AI Suggestion handler
  const handleAiSuggest = () => {
    // Replace with real AI call
    const suggestion = `AI suggested rule on ${
      selectedColumn?.name || "column"
    }`;
    setRuleText(suggestion);
    setAiChatMessages((msgs) => [...msgs, `AI: ${suggestion}`]);
  };

  // Mock submit handler
  const handleSubmit = () => {
    alert(
      `Submitted rule: ${ruleText}\nSQL: ${sqlQuery}\nPass Rate: ${passRate}%`
    );
    // Add logic to save rule & trigger ETL as needed
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar: Column selector */}
      <aside className="w-1/5 border-r border-gray-200 p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Columns</h2>
        <ul>
          {columns.map((col) => (
            <li
              key={col.name}
              className={`cursor-pointer p-2 rounded ${
                selectedColumn?.name === col.name
                  ? "bg-blue-100"
                  : "hover:bg-gray-100"
              }`}
              onClick={() => setSelectedColumn(col)}
            >
              <div className="flex justify-between items-center">
                <span>{col.name}</span>
                <span
                  className="text-xs text-gray-500"
                  title={`${col.nullCount} nulls, ${col.distinctCount} distinct`}
                >
                  i
                </span>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 flex flex-col gap-6">
        {/* Rule input area */}
        <section className="flex flex-col gap-2">
          <label className="font-semibold">
            Rule for: {selectedColumn?.name || "Select a column"}
          </label>
          <textarea
            className="w-full h-24 border border-gray-300 rounded p-2 resize-none"
            placeholder="Type rule here..."
            value={ruleText}
            onChange={(e) => setRuleText(e.target.value)}
            disabled={!selectedColumn}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={validateRule}
              disabled={!ruleText.trim()}
              className="bg-green-500 text-white rounded px-4 py-2 hover:bg-green-600 disabled:opacity-50"
            >
              Validate
            </button>
            <button
              type="button"
              onClick={handleAiSuggest}
              disabled={!selectedColumn}
              className="bg-yellow-500 text-white rounded px-4 py-2 hover:bg-yellow-600 disabled:opacity-50"
              title="Get AI suggested rule"
            >
              AI Suggest
            </button>
          </div>
        </section>

        {/* SQL Query Preview & Pass Rate */}
        <section className="border border-gray-300 rounded p-4 bg-white">
          <h3 className="font-semibold mb-2 text-red-600">SQL Query</h3>
          <pre className="whitespace-pre-wrap break-words text-gray-900">
            {sqlQuery || "SQL query will appear here after validation."}
          </pre>
          {passRate !== null && (
            <p className="mt-2 text-gray-900">
              Pass Rate: <span className="font-semibold">{passRate}%</span>
            </p>
          )}
        </section>

        {/* AI Chat Assistant */}
        <section className="border border-gray-300 rounded p-4 flex flex-col h-48 max-h-48 overflow-auto bg-white">
          <h3 className="font-semibold mb-2 text-red-600">AI Chat Assistant</h3>
          <div className="flex-1 overflow-y-auto mb-2 space-y-1">
            {aiChatMessages.length === 0 ? (
              <p className="text-gray-500">
                Ask the AI or get suggestions here.
              </p>
            ) : (
              aiChatMessages.map((msg, i) => (
                <p key={i} className="text-sm italic text-gray-700">
                  {msg}
                </p>
              ))
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (aiInput.trim()) {
                setAiChatMessages((msgs) => [
                  ...msgs,
                  `User: ${aiInput.trim()}`,
                ]);
                setAiInput("");
                // Add AI chat response logic here
              }
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              className="flex-1 border border-gray-300 rounded px-2 py-1"
              placeholder="Type message"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              disabled={!selectedColumn}
            />
            <button
              type="submit"
              className="bg-blue-500 text-white rounded px-4 py-1 hover:bg-blue-600 disabled:opacity-50"
              disabled={!aiInput.trim() || !selectedColumn}
            >
              Send
            </button>
          </form>
        </section>

        {/* Submit Button */}
        <div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!ruleText.trim() || !selectedColumn}
            className="bg-indigo-600 text-white rounded px-6 py-3 hover:bg-indigo-700 disabled:opacity-50 w-full"
          >
            Submit Rule
          </button>
        </div>
      </main>
    </div>
  );
}
