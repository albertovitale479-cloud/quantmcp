const timestampProperties = {
  start: { type: 'number', description: 'Inclusive Unix timestamp in milliseconds.' },
  end: { type: 'number', description: 'Inclusive Unix timestamp in milliseconds.' },
} as const

const conditionBase = {
  period: { type: 'integer', minimum: 1, maximum: 10000 },
  comparator: { type: 'string', enum: ['above', 'below'] },
} as const

const thresholdCondition = (kind: string, threshold: Record<string, unknown> = { type: 'number' }) => ({
  type: 'object', additionalProperties: false,
  properties: { kind: { const: kind }, ...conditionBase, threshold },
  required: ['kind', 'period', 'comparator', 'threshold'],
})

export const getWorkspaceStateSchema = { type: 'object', additionalProperties: false, properties: {} } as const
export const setActiveAssetSchema = { type: 'object', additionalProperties: false, properties: { asset: { type: 'string', minLength: 1, maxLength: 12, description: 'Available futures symbol, for example NQ.' } }, required: ['asset'] } as const
export const setTimeframeSchema = { type: 'object', additionalProperties: false, properties: { timeframe: { type: 'string', enum: ['1m', '5m', '15m', '30m', '1h'], description: 'Shared workspace aggregation timeframe.' } }, required: ['timeframe'] } as const
export const getMarketDataSchema = { type: 'object', additionalProperties: false, properties: { asset: { type: 'string', minLength: 1, maxLength: 12 }, ...timestampProperties, maxBars: { type: 'integer', minimum: 1, maximum: 500, default: 250 } } } as const
export const calculateIndicatorSchema = { type: 'object', additionalProperties: false, properties: { asset: { type: 'string', minLength: 1, maxLength: 12 }, indicator: { type: 'string', enum: ['SMA', 'EMA', 'RSI', 'ATR', 'ROLLING_VOLATILITY', 'ROLLING_STANDARD_DEVIATION', 'ROLLING_Z_SCORE', 'MOMENTUM'] }, period: { type: 'integer', minimum: 1, maximum: 10000 }, ...timestampProperties, maxValues: { type: 'integer', minimum: 1, maximum: 500, default: 250 } }, required: ['indicator', 'period'] } as const
export const marketConditionsSchema = {
  type: 'array', minItems: 1, maxItems: 6,
  items: { oneOf: [
    { type: 'object', additionalProperties: false, properties: { kind: { enum: ['sma', 'ema', 'previous-high', 'previous-low'] }, ...conditionBase }, required: ['kind', 'period', 'comparator'] },
    thresholdCondition('rsi', { type: 'number', minimum: 0, maximum: 100 }), thresholdCondition('atr'), thresholdCondition('volatility'), thresholdCondition('z-score'), thresholdCondition('momentum'),
    { type: 'object', additionalProperties: false, properties: { kind: { const: 'volatility-percentile' }, ...conditionBase, lookback: { type: 'integer', minimum: 1, maximum: 100000 }, threshold: { type: 'number', minimum: 0, maximum: 100 } }, required: ['kind', 'period', 'comparator', 'lookback', 'threshold'] },
  ] },
} as const
export const queryMarketConditionsSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    asset: { type: 'string', minLength: 1, maxLength: 12 },
    conditions: marketConditionsSchema,
  }, required: ['conditions'],
} as const
export const compareTimeframesSchema = { type: 'object', additionalProperties: false, properties: { asset: { type: 'string', minLength: 1, maxLength: 12 }, timeframes: { type: 'array', minItems: 1, maxItems: 5, uniqueItems: true, items: { type: 'string', enum: ['1m', '5m', '15m', '30m', '1h'] } }, conditions: marketConditionsSchema, forwardHorizons: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'integer', minimum: 1, maximum: 10000 } } }, required: ['timeframes', 'conditions', 'forwardHorizons'] } as const
export const calculateForwardReturnsSchema = { type: 'object', additionalProperties: false, properties: { asset: { type: 'string', minLength: 1, maxLength: 12 }, eventIds: { type: 'array', minItems: 1, maxItems: 1000, items: { type: 'string', minLength: 1, maxLength: 160 } }, horizons: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'integer', minimum: 1, maximum: 10000 } } }, required: ['horizons'] } as const
export const focusChartRangeSchema = { type: 'object', additionalProperties: false, properties: { ...timestampProperties, eventId: { type: 'string', minLength: 1, maxLength: 160 } }, oneOf: [{ required: ['eventId'] }, { required: ['start', 'end'] }] } as const
export const annotateChartSchema = { type: 'object', additionalProperties: false, properties: { eventId: { type: 'string', minLength: 1, maxLength: 160 }, timestamp: { type: 'number', description: 'A Unix-millisecond timestamp of an active-dataset bar.' }, type: { type: 'string', enum: ['note', 'line', 'range', 'marker'] }, label: { type: 'string', minLength: 1, maxLength: 120 }, description: { type: 'string', minLength: 1, maxLength: 500 } }, required: ['type', 'label'], oneOf: [{ required: ['eventId'] }, { required: ['timestamp'] }] } as const
export const createResearchFindingSchema = { type: 'object', additionalProperties: false, properties: { title: { type: 'string', minLength: 1, maxLength: 120 }, summary: { type: 'string', minLength: 1, maxLength: 600 }, confidence: { type: 'string', enum: ['low', 'medium', 'high'] }, relatedEventIds: { type: 'array', maxItems: 100, items: { type: 'string', minLength: 1, maxLength: 160 } } }, required: ['title', 'summary', 'confidence'] } as const
export const getDatasetSummarySchema = { type: 'object', additionalProperties: false, properties: { asset: { type: 'string', minLength: 1, maxLength: 12 } } } as const
export const getSelectedEventSchema = getWorkspaceStateSchema
