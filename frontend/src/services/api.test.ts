import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiFetch } from './api'

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiFetch', () => {
  it('unwraps a successful response body', async () => {
    vi.stubGlobal('fetch', mockFetch(201, { data: { id: 'lead_1' } }))

    const result = await apiFetch<{ data: { id: string } }>('/leads')
    expect(result.data.id).toBe('lead_1')
  })

  it('throws an ApiError carrying the backend field errors', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(400, {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid lead payload',
          details: { email: ['A valid email is required'] },
        },
      }),
    )

    await expect(apiFetch('/leads', { method: 'POST' })).rejects.toThrow(ApiError)

    try {
      await apiFetch('/leads', { method: 'POST' })
      expect.unreachable('should have thrown')
    } catch (err) {
      const error = err as ApiError
      expect(error.status).toBe(400)
      expect(error.code).toBe('VALIDATION_FAILED')
      expect(error.fieldErrors.email).toEqual(['A valid email is required'])
    }
  })

  it('surfaces a rate-limit response as a typed code', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(429, {
        error: { code: 'RATE_LIMITED', message: 'Too many submissions' },
      }),
    )

    try {
      await apiFetch('/leads', { method: 'POST' })
      expect.unreachable('should have thrown')
    } catch (err) {
      const error = err as ApiError
      expect(error.code).toBe('RATE_LIMITED')
      expect(error.fieldErrors).toEqual({})
    }
  })

  it('reports a network failure instead of throwing raw', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    )

    try {
      await apiFetch('/leads')
      expect.unreachable('should have thrown')
    } catch (err) {
      const error = err as ApiError
      expect(error.status).toBe(0)
      expect(error.message).toContain('Could not reach the server')
    }
  })
})
