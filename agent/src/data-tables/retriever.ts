/**
 * Retrieves relevant data tables for a given query via cosine similarity.
 * Mirrors the memory retriever pattern but simpler — no scope/recency scoring,
 * just semantic relevance since tables are project-scoped.
 */

import { generateEmbedding, cosineSimilarity } from "../memory/embeddings.js";
import { getTablesWithEmbeddings, type DataTableWithEmbedding } from "../db/queries/data-tables.js";

export interface ScoredDataTable {
  table: DataTableWithEmbedding;
  score: number;
}

export interface DataTableRetrievalContext {
  projectId: string;
  query: string;
  maxResults?: number;
  threshold?: number;
}

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_THRESHOLD = 0.25;

/**
 * Find tables semantically relevant to the given query.
 * Returns tables sorted by cosine similarity score.
 */
export async function retrieveRelevantTables(
  ctx: DataTableRetrievalContext,
): Promise<ScoredDataTable[]> {
  const tables = getTablesWithEmbeddings(ctx.projectId);
  if (tables.length === 0) return [];

  const queryEmbedding = await generateEmbedding(ctx.query);
  const threshold = ctx.threshold ?? DEFAULT_THRESHOLD;
  const maxResults = ctx.maxResults ?? DEFAULT_MAX_RESULTS;

  const scored: ScoredDataTable[] = [];

  for (const table of tables) {
    if (!table.embedding) continue;
    const score = cosineSimilarity(queryEmbedding, table.embedding);
    if (score >= threshold) {
      scored.push({ table, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults);
}
