import { type CSSProperties } from 'react'
import { View, Text, Textarea, ScrollView } from '@tarojs/components'

/**
 * ReasonModal — custom overlay for text/checkbox input.
 *
 * Taro.showModal only supports simple confirm/cancel, so we use this component
 * for flows that need a textarea (flag reason, report reason) or a multi-select
 * checkbox list + textarea (reject reasons).
 *
 * The modal is a fixed full-screen overlay with a centered card. It's
 * intentionally uncontrolled in terms of visibility — the parent owns
 * `visible` and renders/unmounts accordingly. Internal state (reason text,
 * selected tags) is also owned by the parent via the value/onChange props.
 */

interface ReasonModalProps {
  visible: boolean
  title: string
  /** Optional list of selectable reason labels (e.g. COMMON_REJECT_REASONS). When provided, a checkbox list is rendered. */
  reasons?: readonly string[]
  /** Selected reason indices (into `reasons`). */
  reasonTags?: number[]
  onReasonTagsChange?: (tags: number[]) => void
  /** Free-text reason. */
  reason: string
  onReasonChange: (text: string) => void
  /** When true, the confirm button is disabled if `reason` is empty (used for flag/report). */
  reasonRequired?: boolean
  reasonPlaceholder?: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  confirmDanger?: boolean
}

const CARD_STYLE: CSSProperties = {
  boxShadow: '0 8px 40px rgba(0, 0, 0, 0.12)',
}

export default function ReasonModal({
  visible,
  title,
  reasons,
  reasonTags = [],
  onReasonTagsChange,
  reason,
  onReasonChange,
  reasonRequired = false,
  reasonPlaceholder = '请输入原因…',
  onConfirm,
  onCancel,
  confirmText = '确定',
  confirmDanger = false,
}: ReasonModalProps) {
  if (!visible) return null

  const toggleTag = (idx: number) => {
    if (!onReasonTagsChange) return
    if (reasonTags.includes(idx)) {
      onReasonTagsChange(reasonTags.filter((t) => t !== idx))
    } else {
      onReasonTagsChange([...reasonTags, idx])
    }
  }

  const canConfirm = !reasonRequired || reason.trim().length > 0

  return (
    <View
      className='fixed inset-0 z-[70] flex items-center justify-center'
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      catchMove
    >
      <View
        className='mx-6 w-full max-w-md rounded-2xl bg-surface'
        style={CARD_STYLE}
      >
        {/* Header */}
        <View className='flex items-center justify-between border-b border-outline-variant/20 px-5 py-4'>
          <Text className='text-base font-semibold text-on-surface'>
            {title}
          </Text>
          <View
            onClick={onCancel}
            className='flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant'
          >
            <Text className='material-symbols-outlined' style={{ fontSize: '20px' }}>
              close
            </Text>
          </View>
        </View>

        {/* Body */}
        <ScrollView scrollY className='px-5 py-4' style={{ maxHeight: '50vh' }}>
          {/* Checkbox list (optional) */}
          {reasons && reasons.length > 0 && (
            <View className='mb-4'>
              <Text className='mb-2 block text-sm font-medium text-on-surface'>
                常见原因（可多选）
              </Text>
              <View className='flex flex-wrap gap-2'>
                {reasons.map((label, idx) => {
                  const selected = reasonTags.includes(idx)
                  return (
                    <View
                      key={idx}
                      onClick={() => toggleTag(idx)}
                      className={`rounded-full px-3 py-1.5 ${
                        selected
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                      style={{ fontSize: '13px', fontWeight: '500' }}
                    >
                      {label}
                    </View>
                  )
                })}
              </View>
            </View>
          )}

          {/* Textarea */}
          <View>
            <Text className='mb-2 block text-sm font-medium text-on-surface'>
              {reasons ? '其他原因' : '请输入原因'}
            </Text>
            <Textarea
              value={reason}
              onInput={(e) => onReasonChange(e.detail.value)}
              maxlength={500}
              autoFocus
              placeholder={reasonPlaceholder}
              placeholderClass='text-outline'
              className='w-full rounded-xl bg-surface-container-lowest p-3 text-sm text-on-surface'
              style={{
                minHeight: '80px',
                border: '1px solid rgba(114, 120, 121, 0.15)',
                fontSize: '14px',
                lineHeight: '20px',
              }}
            />
            <Text className='mt-1 block text-right text-xs text-outline'>
              {reason.length}/500
            </Text>
          </View>

          {/* Hint for required reason */}
          {reasonRequired && reason.trim().length === 0 && (
            <Text className='mt-1 block text-xs' style={{ color: '#ba1a1a' }}>
              请填写原因后提交
            </Text>
          )}
        </ScrollView>

        {/* Footer buttons */}
        <View className='flex gap-3 border-t border-outline-variant/20 px-5 py-4'>
          <View
            onClick={onCancel}
            className='flex flex-1 items-center justify-center rounded-full bg-surface-container-high py-2.5'
          >
            <Text className='text-sm font-semibold text-on-surface-variant'>
              取消
            </Text>
          </View>
          <View
            onClick={canConfirm ? onConfirm : undefined}
            className={`flex flex-1 items-center justify-center rounded-full py-2.5 ${
              canConfirm
                ? confirmDanger
                  ? 'bg-error text-on-error'
                  : 'bg-primary text-on-primary'
                : 'bg-surface-container-high text-outline'
            }`}
          >
            <Text className='text-sm font-semibold'>{confirmText}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
