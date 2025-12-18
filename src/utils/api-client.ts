import https from 'https'

export interface ApiClientConfig {
    baseUrl?: string
    timeout?: number
    headers?: Record<string, string>
    retries?: number
    retryDelay?: number
    proxy?: string | false
    httpsAgent?: https.Agent
    autoDisposeAfter?: number
}

export interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
    headers?: Record<string, string>
    body?: any
    timeout?: number
    retries?: number
}

export interface ApiResponse<T = any> {
    data: T
    status: number
    statusText: string
    headers: Record<string, string>
}

export class ApiClient implements Disposable {
    private isDisposed: boolean = false
    private abortController: AbortController
    private activeRequests: Set<Promise<any>> = new Set()
    private autoDisposeTimer?: NodeJS.Timeout
    private lastRequestTime: number = Date.now()

    constructor(private config: ApiClientConfig = {}) {
        this.abortController = new AbortController()
        if (config.autoDisposeAfter) {
            this.startAutoDisposeTimer(config.autoDisposeAfter)
        }
    }

    async get<T = any>(
        url: string,
        options: Omit<RequestOptions, 'method' | 'body'> = {},
    ): Promise<ApiResponse<T>> {
        return this.request<T>(url, { ...options, method: 'GET' })
    }

    async post<T = any>(
        url: string,
        data?: any,
        options: Omit<RequestOptions, 'method'> = {},
    ): Promise<ApiResponse<T>> {
        return this.request<T>(url, { ...options, method: 'POST', body: data })
    }

    async put<T = any>(
        url: string,
        data?: any,
        options: Omit<RequestOptions, 'method'> = {},
    ): Promise<ApiResponse<T>> {
        return this.request<T>(url, { ...options, method: 'PUT', body: data })
    }

    async delete<T = any>(
        url: string,
        options: Omit<RequestOptions, 'method' | 'body'> = {},
    ): Promise<ApiResponse<T>> {
        return this.request<T>(url, { ...options, method: 'DELETE' })
    }

    async patch<T = any>(
        url: string,
        data?: any,
        options: Omit<RequestOptions, 'method'> = {},
    ): Promise<ApiResponse<T>> {
        return this.request<T>(url, { ...options, method: 'PATCH', body: data })
    }

    async request<T = any>(
        url: string,
        options: RequestOptions = {},
    ): Promise<ApiResponse<T>> {
        if (this.isDisposed) {
            throw new Error('Api Client has been disposed')
        }
        this.lastRequestTime = Date.now()
        this.resetAutoDisposeTimer()

        const {
            method = 'GET',
            headers = {},
            body,
            timeout = this.config.timeout || 20000,
            retries = this.config.retries || 0,
        } = options

        const fullUrl = this.buildUrl(url)
        const requestHeaders = this.buildHeaders(headers)

        let lastError: Error

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const requestPromise = this.executeRequest<T>(fullUrl, {
                    method,
                    headers: requestHeaders,
                    body: this.prepareBody(body),
                    signal: this.abortController.signal,
                    timeout,
                })

                this.activeRequests.add(requestPromise)

                try {
                    const response = await requestPromise
                    return response
                } finally {
                    this.activeRequests.delete(requestPromise)
                }
            } catch (error) {
                lastError = error as Error

                if (
                    this.abortController.signal.aborted ||
                    attempt === retries
                ) {
                    throw lastError
                }
                // Wait before retry
                const delayMs = this.config.retryDelay ?? (Math.pow(2, attempt) * 1000)
                await this.delay(delayMs)
            }
        }

        throw lastError!
    }

    // Execute the actual HTTP request
    private async executeRequest<T>(
        url: string,
        init: RequestInit & { timeout?: number },
    ): Promise<ApiResponse<T>> {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), init.timeout)

        const fetchOptions: any = {
            ...init,
            signal: controller.signal,
        }

        if (this.config.httpsAgent) {
            fetchOptions.agent = this.config.httpsAgent
        }

        if (this.config.proxy) {
            fetchOptions.proxy = this.config.proxy
        }

        try {
            const response = await fetch(url, fetchOptions)

            clearTimeout(timeoutId)

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}: ${response.statusText}`,
                )
            }

            const data = await this.parseResponse<T>(response)
            const headers = this.parseHeaders(response.headers)

            return {
                data,
                status: response.status,
                statusText: response.statusText,
                headers,
            }
        } catch (error) {
            clearTimeout(timeoutId)
            throw error
        }
    }

    // Parse response based on content type
    private async parseResponse<T>(response: Response): Promise<T> {
        const contentType = response.headers.get('content-type') || ''

        if (contentType.includes('application/json')) {
            return await response.json()
        } else if (contentType.includes('text/')) {
            return (await response.text()) as unknown as T
        } else {
            return (await response.blob()) as unknown as T
        }
    }

    // Parse response headers
    private parseHeaders(headers: Headers): Record<string, string> {
        const result: Record<string, string> = {}
        headers.forEach((value, key) => {
            result[key] = value
        })
        return result
    }

    private buildUrl(url: string): string {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url
        }

        const baseUrl = this.config.baseUrl || ''
        return `${baseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`
    }

    private buildHeaders(
        customHeaders: Record<string, string>,
    ): Record<string, string> {
        return {
            'Content-Type': 'application/json' as string,
            ...this.config.headers,
            ...customHeaders,
        }
    }

    // Prepare request body
    private prepareBody(body: any): string | FormData | Blob | undefined {
        if (!body) return undefined

        if (body instanceof FormData || body instanceof Blob) {
            return body
        }

        if (typeof body === 'object') {
            return JSON.stringify(body)
        }

        return String(body)
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    private startAutoDisposeTimer(autoDisposeAfter: number): void {
        this.autoDisposeTimer = setTimeout(() => {
            const timeSinceLastRequest = Date.now() - this.lastRequestTime
            if (
                timeSinceLastRequest >= autoDisposeAfter &&
                this.activeRequests.size === 0
            ) {
                console.log('ApiClient auto-disposing due to inactivity')
                this.dispose()
            } else {
                // If there are active requests or recent requests, delay auto dispose
                this.startAutoDisposeTimer(autoDisposeAfter)
            }
        }, autoDisposeAfter)
    }

    private resetAutoDisposeTimer(): void {
        if (this.autoDisposeTimer) {
            clearTimeout(this.autoDisposeTimer)
            this.autoDisposeTimer = undefined
        }

        if (this.config.autoDisposeAfter) {
            this.startAutoDisposeTimer(this.config.autoDisposeAfter)
        }
    }

    // Cancel all ongoing requests
    abort(): void {
        this.abortController.abort()
        this.abortController = new AbortController()
    }

    dispose(): void {
        if (this.isDisposed) return

        this.isDisposed = true
        this.abortController.abort()
        this.activeRequests.clear()

        // Clean up auto dispose timer
        if (this.autoDisposeTimer) {
            clearTimeout(this.autoDisposeTimer)
            this.autoDisposeTimer = undefined
        }
    }

    get disposed(): boolean {
        return this.isDisposed
    }

    [Symbol.dispose](): void {
        this.dispose()
    }
}

export function withApiClient<T>(
    config: ApiClientConfig,
    callback: (client: ApiClient) => Promise<T>,
): Promise<T> {
    const client = new ApiClient(config)

    return callback(client).finally(() => {
        client.dispose()
    })
}

export function createApiClient(config: ApiClientConfig = {}): ApiClient {
    return new ApiClient(config)
}

/**
 * ApiClient Pool for reusing clients with same configuration
 */
class ApiClientPool {
    private static pools = new Map<string, ApiClient>()

    static getClient(config: ApiClientConfig): ApiClient {
        const key = JSON.stringify(config)

        let client = this.pools.get(key)
        if (!client || client.disposed) {
            client = new ApiClient({
                ...config,
                autoDisposeAfter: config.autoDisposeAfter || 300000, // Default 5 minutes auto dispose
            })
            this.pools.set(key, client)
        }

        return client
    }

    static disposeAll(): void {
        this.pools.forEach((client) => client.dispose())
        this.pools.clear()
    }
}

export function getSharedApiClient(config: ApiClientConfig = {}): ApiClient {
    return ApiClientPool.getClient(config)
}

export function disposeAllSharedClients(): void {
    ApiClientPool.disposeAll()
}
