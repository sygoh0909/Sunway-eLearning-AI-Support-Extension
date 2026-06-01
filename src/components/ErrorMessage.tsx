interface Props { message: string }

export default function ErrorMessage({ message }: Props) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
      {message}
    </div>
  )
}