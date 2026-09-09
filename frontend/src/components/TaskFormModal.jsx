import { useState } from 'react'

const EMPTY_TASK = {
  title: '',
  description: '',
  priority: 'medium',
  due_date: '',
  status: 'pending',
}

export default function TaskFormModal({ initialTask, onSave, onClose }) {
  const [form, setForm] = useState(initialTask ? { ...EMPTY_TASK, ...initialTask } : EMPTY_TASK)
  const [saving, setSaving] = useState(false)
  const isEditing = Boolean(initialTask)

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await onSave({ ...form, due_date: form.due_date || null })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
      <div className="w-full max-w-md rounded-sm border border-paperline bg-paper p-6 shadow-xl">
        <h2 className="font-serif text-xl italic text-ink">
          {isEditing ? 'Edit task' : 'Add a task'}
        </h2>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-inkfaint">Title</label>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="What needs to get done?"
              className="focus-ring mt-1 w-full border-b border-paperline bg-transparent py-1.5 text-ink placeholder:text-inkfaint/70"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-inkfaint">Notes</label>
            <textarea
              value={form.description || ''}
              onChange={(e) => update('description', e.target.value)}
              rows={2}
              placeholder="Optional details"
              className="focus-ring mt-1 w-full resize-none border-b border-paperline bg-transparent py-1.5 text-sm text-ink placeholder:text-inkfaint/70"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-medium uppercase tracking-wide text-inkfaint">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => update('priority', e.target.value)}
                className="focus-ring mt-1 w-full border-b border-paperline bg-transparent py-1.5 text-sm text-ink"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="flex-1">
              <label className="text-xs font-medium uppercase tracking-wide text-inkfaint">Due date</label>
              <input
                type="date"
                value={form.due_date || ''}
                onChange={(e) => update('due_date', e.target.value)}
                className="focus-ring mt-1 w-full border-b border-paperline bg-transparent py-1.5 text-sm text-ink"
              />
            </div>
          </div>

          {isEditing && (
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-inkfaint">Status</label>
              <select
                value={form.status}
                onChange={(e) => update('status', e.target.value)}
                className="focus-ring mt-1 w-full border-b border-paperline bg-transparent py-1.5 text-sm text-ink"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          )}

          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="focus-ring px-3 py-1.5 text-sm text-inkfaint hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.title.trim()}
              className="focus-ring rounded-sm bg-ink px-4 py-1.5 text-sm text-paper hover:bg-ochredark disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
