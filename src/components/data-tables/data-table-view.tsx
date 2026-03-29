/**
 * Root view for Data Tables — routes between list and detail views
 * based on the current contentView and selectedDataTableId.
 */

import { useAppStore } from "@/stores/app-store";
import { DataTableListView } from "./data-table-list-view";
import { DataTableDetailView } from "./data-table-detail-view";

export function DataTableView() {
  const { contentView, selectedDataTableId } = useAppStore();

  if (contentView === "data-table-detail" && selectedDataTableId) {
    return <DataTableDetailView tableId={selectedDataTableId} />;
  }

  return <DataTableListView />;
}
