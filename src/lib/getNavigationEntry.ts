/*
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {NavigationTimingPolyfillEntry} from '../types.js';

// 生成 Navigation Timing API 的 Polyfill 对象，用于兼容不支持 Navigation Timing API 的浏览器
const getNavigationEntryFromPerformanceTiming =
  (): NavigationTimingPolyfillEntry => {
    const timing = performance.timing;
    const type = performance.navigation.type;

    const navigationEntry: {[key: string]: number | string} = {
      entryType: 'navigation',
      startTime: 0,
      type: type == 2 ? 'back_forward' : type === 1 ? 'reload' : 'navigate',
    };

    for (const key in timing) {
      if (key !== 'navigationStart' && key !== 'toJSON') {
        navigationEntry[key] = Math.max(
          (timing[key as keyof PerformanceTiming] as number) -
            timing.navigationStart,
          0
        );
      }
    }
    return navigationEntry as unknown as NavigationTimingPolyfillEntry;
  };

export const getNavigationEntry = ():
  | PerformanceNavigationTiming
  | NavigationTimingPolyfillEntry
  | undefined => {
  if (window.__WEB_VITALS_POLYFILL__) {
    return (
      window.performance &&
      ((performance.getEntriesByType &&
        performance.getEntriesByType('navigation')[0]) ||
        getNavigationEntryFromPerformanceTiming())
    );
  } else {
    return (
      window.performance &&
      performance.getEntriesByType &&
      performance.getEntriesByType('navigation')[0]
    );
  }
};
