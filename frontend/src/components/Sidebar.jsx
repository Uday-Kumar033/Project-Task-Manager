import { useAuth } from '../context/AuthContext.jsx'

const NAV_ITEMS = [
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'all', label: 'All tasks' },
  { key: 'completed', label: 'Completed' },
]

export default function Sidebar({ active, onSelect, stats }) {
  const { user, logout } = useAuth()

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col justify-between border-r border-paperline bg-paper px-6 py-8">
      <div>
        <h1 className="font-serif text-2xl italic text-ink">Tasks.</h1>
        <p className="mt-1 text-sm text-inkfaint">
          {stats ? `${stats.pending + stats.in_progress} open, ${stats.completed} done` : ' '}
        </p>

        <nav className="mt-10 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              className={`focus-ring rounded-sm px-3 py-2 text-left text-sm transition-colors ${
                active === item.key
                  ? 'bg-ink text-paper'
                  : 'text-ink hover:bg-paperline/50'
              }`}
            >
              {item.label}
              {item.key === 'overdue' && stats?.overdue > 0 && (
                <span className="ml-2 text-clay">{stats.overdue}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="border-t border-paperline pt-4">
        <p className="truncate text-sm font-medium text-ink">{user?.name}</p>
        <p className="truncate text-xs text-inkfaint">{user?.email}</p>
        <button
          onClick={logout}
          className="focus-ring mt-3 text-sm text-inkfaint underline decoration-paperline underline-offset-4 hover:text-clay"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
