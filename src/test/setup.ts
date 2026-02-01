/**
 * Vitest setup: mock server-only so modules that import it (e.g. extractText) can run in tests.
 */
import { vi } from "vitest";

vi.mock("server-only", () => ({}));
