// Monitor events carry no status; a failed or killed task keeps its row.
export const isQuietNotification = (status: string | undefined) => status === undefined || status === 'completed'
