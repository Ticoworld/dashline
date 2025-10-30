// Test environment setup: provide minimal env defaults to avoid heavy external dependencies
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/dashline_test";
process.env.RPC_URLS = process.env.RPC_URLS || "http://127.0.0.1:8545";

// Other test setup can go here
