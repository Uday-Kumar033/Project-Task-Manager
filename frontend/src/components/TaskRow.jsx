const PRIORITY_COLOR = {
  low: 'bg-sage',
  medium: 'bg-ochre',
  high: 'bg-clay',
}

function formatDueDate(dueDate) {
  if (!dueDate) return null
  const date = new Date(dueDate + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((date - today) / 86400000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function TaskRow({ task, onToggleComplete, onEdit, onDelete }) {
  const isCompleted = task.status === 'completed'
  const dueLabel = formatDueDate(task.due_date)
  const isOverdue = task.due_date && !isCompleted && new Date(task.due_date) < new Date(new Date().toDateString())

  return (
    <div className="group flex items-center gap-4 py-3 pr-2">
      <button
        aria-label={isCompleted ? 'Mark as not done' : 'Mark as done'}
        onClick={() => onToggleComplete(task)}
        className={`focus-ring flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border-2 transition-colors ${
          isCompleted ? 'border-sage bg-sage' : 'border-inkfaint bg-transparent hover:border-ink'
        }`}
      >
        {isCompleted && (
          <svg viewBox="0 0 16 16" className="h-3 w-3 fill-none stroke-paper stroke-[2.5]">
            <path d="M3 8.5L6.2 11.5L13 4.5" />
          </svg>
        )}
      </button>

      <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_COLOR[task.priority]}`} title={`${task.priority} priority`} />

      <div className="min-w-0 flex-1">
        <p className={`truncate text-[15px] ${isCompleted ? 'text-inkfaint line-through' : 'text-ink'}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="truncate text-xs text-inkfaint">{task.description}</p>
        )}
      </div>

      {dueLabel && (
        <span className={`shrink-0 text-xs ${isOverdue ? 'text-clay' : 'text-inkfaint'}`}>
          {dueLabel}
        </span>
      )}

      <div className="flex shrink-0 gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => onEdit(task)}
          className="focus-ring text-xs text-inkfaint hover:text-ink"
          aria-label="Edit task"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(task)}
          className="focus-ring text-xs text-inkfaint hover:text-clay"
          aria-label="Delete task"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
