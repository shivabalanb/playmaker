import { useRouter } from "next/navigation";

interface ErrorStateProps {
  error: string;
}

export function ErrorState({ error }: ErrorStateProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#0a1428] via-[#1a2332] to-[#0f1923] text-white">
      <h2 className="text-3xl font-bold text-red-400 mb-4">Error</h2>
      <p className="text-gray-300 text-lg">{error}</p>
      <button
        onClick={() => router.back()}
        className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
      >
        Go Back
      </button>
    </div>
  );
}

