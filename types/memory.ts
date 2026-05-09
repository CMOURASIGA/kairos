export type MemoryPriority = "P0" | "P1" | "P2" | "P3" | "P4";

export type MemoryRecord = {
  id: string;
  userId: string;
  type: string;
  priority: MemoryPriority;
  content: string;
  createdAt: string;
};

export type MemoryCompressionResult = {
  compressed: boolean;
  archivedCount: number;
  summaryMemoryId?: string;
  reason?: string;
};

export type MemoryPriorityMaintenanceResult = {
  processed: number;
  changed: number;
  discarded: number;
  fixed: number;
  highPriority: number;
};
