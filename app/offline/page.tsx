export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-sm">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <span className="text-4xl font-bold text-primary">₹</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">You're offline</h1>
          <p className="text-muted-foreground text-sm">
            No internet connection detected. Please check your connection and try again.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="w-full py-3 px-6 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
