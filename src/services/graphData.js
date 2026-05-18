import { defaultGraphData } from '../data/defaultGraph.js';

export async function loadGraphData() {
  try {
    const response = await fetch('/api/data', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`数据接口返回 ${response.status}`);
    }

    const data = await response.json();
    return {
      data,
      source: 'cloud',
      error: null,
    };
  } catch (error) {
    return {
      data: defaultGraphData,
      source: 'default',
      error: error.message,
    };
  }
}
