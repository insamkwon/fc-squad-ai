import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-7rem)] px-4 sm:px-6">
      <div className="text-center max-w-lg w-full">
        <h1 className="text-3xl sm:text-4xl font-bold text-yellow-400 mb-3 sm:mb-4">
          FC Squad AI
        </h1>
        <p className="text-base sm:text-lg text-gray-400 mb-1.5 sm:mb-2">
          FC Online AI 기반 스쿼드 추천 + 선수 데이터베이스
        </p>
        <p className="text-sm text-gray-500 mb-6 sm:mb-8">
          조건을 입력하면 AI가 자동으로 최적의 스쿼드를 추천합니다
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <Link
            href="/chat"
            className="rounded-lg bg-yellow-500 px-6 py-3.5 text-center font-medium text-gray-900 hover:bg-yellow-400 active:bg-yellow-300 transition-colors tap-target"
          >
            AI 채팅으로 스쿼드 만들기
          </Link>
          <div className="flex gap-3 sm:gap-4">
            <Link
              href="/players"
              className="flex-1 sm:flex-initial rounded-lg bg-gray-800 px-6 py-3 text-center font-medium hover:bg-gray-700 active:bg-gray-600 transition-colors tap-target"
            >
              선수 DB
            </Link>
            <Link
              href="/squad-builder"
              className="flex-1 sm:flex-initial rounded-lg bg-gray-800 px-6 py-3 text-center font-medium hover:bg-gray-700 active:bg-gray-600 transition-colors tap-target"
            >
              스쿼드 빌더
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
