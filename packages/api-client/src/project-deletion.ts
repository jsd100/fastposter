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

// Retrying one task returns only that task. Apply the response to the same
// identity and leave every other row untouched, otherwise the whole page
// collapses into duplicates of the retried task.
export function replaceDeletionTask(
  tasks: ProjectDeletionDTO[],
  next: ProjectDeletionDTO,
): ProjectDeletionDTO[] {
  return tasks.map((task) =>
    task.id === next.id ? mergeDeletionStatus(task, next) : task,
  );
}
