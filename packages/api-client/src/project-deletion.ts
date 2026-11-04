import type { ProjectDeletionDTO } from "./generated";

export function isDeletionComplete(task: ProjectDeletionDTO): boolean {
  return task.state === "completed";
}

export function mergeDeletionStatus(
  previous: ProjectDeletionDTO,
  next: ProjectDeletionDTO,
): ProjectDeletionDTO {
  if (previous.id !== next.id) return next;
  return isDeletionComplete(previous) ? previous : next;
}
