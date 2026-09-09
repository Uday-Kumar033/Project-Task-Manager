import { useEffect, useMemo, useState, useCallback } from 'react'
import client from '../api/client'
import Sidebar from '../components/Sidebar.jsx'
import TaskRow from '../components/TaskRow.jsx'
import TaskFormModal from '../components/TaskFormModal.jsx'

const FILTER_LABELS = {
  today: 'Today',
  upcoming: 'Upcoming',
  all: 'All tasks',
  completed: 'Completed',
}

const EMPTY_STATE_COPY = {
  today: "Nothing due today. Add a task or check what's upcoming.",
  upcoming: 'No upcoming tasks yet.',
  all: 'No tasks yet — add your first one to get started.',
  completed: "Nothing completed yet. It'll show up here once you check something off.",
}

function isSameDay(dateStr, ref) {
  if (!dateStr) return false
  const d = new Date(dateStr + 'T00:00:00')
  return d.toDateString() === ref.toDateString()
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState([])
  const [stats, setStats] = useState(null)
  const [filter, setFilter] = useState('today')
  const [loading, setLoading] = useState(true)
  const [modalTask, setModalTask] = useState(undefined) // undefined = closed, null = new, object = editing

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [tasksRes, statsRes] = await Promise.all([
        client.get('/tasks'),
        client.get('/tasks/stats'),
      ])
      setTasks(tasksRes.data)
      setStats(statsRes.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const visibleTasks = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return tasks.filter((task) => {
      const completed = task.status === 'completed'
      if (filter === 'completed') return completed
      if (completed) return false

      if (filter === 'today') return isSameDay(task.due_date, today)
      if (filter === 'upcoming') return task.due_date && new Date(task.due_date + 'T00:00:00') > today
      return true // 'all'
    })
  }, [tasks, filter])

  async function handleSave(formValues) {
    if (modalTask && modalTask.id) {
      await client.put(`/tasks/${modalTask.id}`, formValues)
    } else {
      await client.post('/tasks', formValues)
    }
    setModalTask(undefined)
    await loadData()
  }

  async function handleToggleComplete(task) {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed'
    await client.put(`/tasks/${task.id}`, { status: nextStatus })
    await loadData()
  }

  async function handleDelete(task) {
    if (!window.confirm(`Delete "${task.title}"?`)) return
    await client.delete(`/tasks/${task.id}`)
    await loadData()
  }

  return (
    <div className="flex h-screen bg-paper">
      <Sidebar active={filter} onSelect={setFilter} stats={stats} />

      <main className="flex-1 overflow-y-auto px-10 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl text-ink">{FILTER_LABELS[filter]}</h2>
            <button
              onClick={() => setModalTask(null)}
              className="focus-ring rounded-sm bg-ink px-4 py-2 text-sm text-paper hover:bg-ochredark"
            >
              + New task
            </button>
          </div>

          <div className="ruled-paper mt-6 min-h-[400px]">
            {loading ? (
              <p className="pt-6 text-sm text-inkfaint">Loading…</p>
            ) : visibleTasks.length === 0 ? (
              <p className="pt-6 text-sm text-inkfaint">{EMPTY_STATE_COPY[filter]}</p>
            ) : (
              visibleTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggleComplete={handleToggleComplete}
                  onEdit={(t) => setModalTask(t)}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>
        </div>
      </main>

      {modalTask !== undefined && (
        <TaskFormModal
          initialTask={modalTask}
          onSave={handleSave}
          onClose={() => setModalTask(undefined)}
        />
      )}
    </div>
  )
}
