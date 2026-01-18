import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn (class name utility)', () => {
  describe('basic usage', () => {
    it('returns a single class name as-is', () => {
      expect(cn('bg-red-500')).toBe('bg-red-500')
    })

    it('joins multiple class names', () => {
      expect(cn('p-4', 'm-2')).toBe('p-4 m-2')
    })

    it('returns empty string for no inputs', () => {
      expect(cn()).toBe('')
    })

    it('handles multiple space-separated classes in a single string', () => {
      expect(cn('p-4 m-2', 'text-lg')).toBe('p-4 m-2 text-lg')
    })
  })

  describe('conditional classes', () => {
    it('handles boolean conditions - true', () => {
      const isActive = true
      expect(cn('base', isActive && 'active')).toBe('base active')
    })

    it('handles boolean conditions - false', () => {
      const isActive = false
      expect(cn('base', isActive && 'active')).toBe('base')
    })

    it('handles object syntax with true values', () => {
      expect(cn({ 'bg-red-500': true, 'text-white': true })).toBe('bg-red-500 text-white')
    })

    it('handles object syntax with false values', () => {
      expect(cn({ 'bg-red-500': true, 'text-white': false })).toBe('bg-red-500')
    })

    it('handles mixed string and object syntax', () => {
      expect(cn('base-class', { conditional: true })).toBe('base-class conditional')
    })
  })

  describe('tailwind class merging', () => {
    it('merges conflicting background colors (keeps last)', () => {
      expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
    })

    it('merges conflicting padding values (keeps last)', () => {
      expect(cn('p-4', 'p-8')).toBe('p-8')
    })

    it('merges conflicting text sizes (keeps last)', () => {
      expect(cn('text-sm', 'text-lg')).toBe('text-lg')
    })

    it('preserves non-conflicting classes', () => {
      expect(cn('bg-red-500', 'p-4', 'bg-blue-500', 'm-2')).toBe('p-4 bg-blue-500 m-2')
    })

    it('handles conflicting flex directions', () => {
      expect(cn('flex-row', 'flex-col')).toBe('flex-col')
    })

    it('handles conflicting display utilities', () => {
      expect(cn('block', 'hidden')).toBe('hidden')
    })
  })

  describe('falsy value handling', () => {
    it('ignores null values', () => {
      expect(cn('class1', null, 'class2')).toBe('class1 class2')
    })

    it('ignores undefined values', () => {
      expect(cn('class1', undefined, 'class2')).toBe('class1 class2')
    })

    it('ignores empty strings', () => {
      expect(cn('class1', '', 'class2')).toBe('class1 class2')
    })

    it('ignores false boolean', () => {
      expect(cn('class1', false, 'class2')).toBe('class1 class2')
    })

    it('ignores 0', () => {
      expect(cn('class1', 0, 'class2')).toBe('class1 class2')
    })
  })

  describe('array inputs', () => {
    it('handles arrays of class names', () => {
      expect(cn(['class1', 'class2'])).toBe('class1 class2')
    })

    it('handles nested arrays', () => {
      expect(cn(['class1', ['class2', 'class3']])).toBe('class1 class2 class3')
    })

    it('handles arrays with conditional values', () => {
      expect(cn(['class1', false && 'class2', 'class3'])).toBe('class1 class3')
    })
  })
})
