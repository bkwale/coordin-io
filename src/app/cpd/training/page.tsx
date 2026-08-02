'use client'

import { GraduationCap } from 'lucide-react'

export default function TrainingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">Training Plans</h1>
        <p className="text-[13px] text-ink-400 mt-1">Team training schedules and progress</p>
      </div>
      <div className="bg-white rounded-xl border border-ink-100 p-12 text-center">
        <GraduationCap className="w-12 h-12 text-ink-200 mx-auto mb-4" />
        <p className="text-[15px] font-medium text-ink-700">No training plans yet</p>
        <p className="text-[12px] text-ink-400 mt-2 max-w-md mx-auto">
          Create training plans to track team skill development and certification progress.
        </p>
      </div>
    </div>
  )
}
