import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-7rem)] px-4 sm:px-6">
      <div className="text-center max-w-lg w-full">
        {/* Hero badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/20 bg-yellow-500/5 px-3 py-1 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-xs font-medium text-yellow-400/80 tracking-wide">
            Powered by Nexon FC Online API
          </span>
        </div>

        {/* Title with gradient */}
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 leading-tight">
          <span className="bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent">
            FC Squad AI
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-gray-300 mb-2">
          FC Online AI 기반 스쿼드 추천
        </p>
        <p className="text-sm text-gray-500 mb-8 sm:mb-10 max-w-xs mx-auto leading-relaxed">
          조건을 입력하면 AI가 자동으로 최적의 스쿼드를 추천합니다
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          {/* Primary CTA */}
          <Link
            href="/chat"
            className="group relative rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 px-6 py-3.5 text-center font-semibold text-gray-900 shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/30 hover:from-yellow-300 hover:to-amber-400 active:scale-[0.97] transition-all tap-target"
          >
            <span className="relative z-10">AI 채팅으로 스쿼드 만들기</span>
          </Link>

          {/* Secondary buttons */}
          <div className="flex gap-3 sm:gap-4">
            <Link
              href="/players"
              className="flex-1 sm:flex-initial rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-center font-medium text-gray-200 hover:bg-white/10 hover:border-white/20 active:bg-white/15 active:scale-[0.97] transition-all tap-target backdrop-blur-sm"
            >
              선수 DB
            </Link>
            <Link
              href="/squad-builder"
              className="flex-1 sm:flex-initial rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-center font-medium text-gray-200 hover:bg-white/10 hover:border-white/20 active:bg-white/15 active:scale-[0.97] transition-all tap-target backdrop-blur-sm"
            >
              스쿼드 빌더
            </Link>
          </div>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mt-10 sm:mt-12">
          {[
            { label: '자연어 스쿼드 생성', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
            { label: '실시간 선수 시세', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
            { label: '팀컬러 스쿼드', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
          ].map(({ label, icon }) => (
            <div
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.03] px-3 py-1.5 text-xs text-gray-400"
            >
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
              </svg>
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
