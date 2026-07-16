export default function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center py-6">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}