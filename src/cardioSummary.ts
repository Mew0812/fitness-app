import {cardioFields} from './data'
import type {CardioWorkout} from './data'

export function cardioSummaryText(record: CardioWorkout, distanceOnly: boolean, climbOnly: boolean) {
  if (distanceOnly) return record.metrics.distance === undefined ? '走行距離は未記録です。' : record.metrics.distance + 'km'
  const details = cardioFields.filter(({key})=>!climbOnly || key==='floors' || key==='steps').flatMap(({key,unit}) => {
    const value = record.metrics[key]
    return value === undefined ? [] : [key === 'incline' ? '傾斜' + value + unit : value.toLocaleString('ja-JP',{maximumFractionDigits:20}) + unit]
  })
  return [...(!climbOnly && record.minutes !== undefined ? [record.minutes + '分'] : []), ...details].join(' · ') || '階数・ステップ数は未記録です。'
}

