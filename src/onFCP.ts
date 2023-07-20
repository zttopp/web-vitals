/*
 * Copyright 2020 Google LLC
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

import {onBFCacheRestore} from './lib/bfcache.js';
// BFCache浏览器前进后退的时候会缓存，在iframe中BFCache缓存会失效
import {bindReporter} from './lib/bindReporter.js';
// 返回一个函数，如果调用传参true，就执行创建时的那个callback
import {doubleRAF} from './lib/doubleRAF.js';
// 每帧都执行callback
import {getActivationStart} from './lib/getActivationStart.js';
// 获取页面激活时间
import {getVisibilityWatcher} from './lib/getVisibilityWatcher.js';
// 初始化指标
import {initMetric} from './lib/initMetric.js';
import {observe} from './lib/observe.js';
import {whenActivated} from './lib/whenActivated.js';
import {
  FCPMetric,
  FCPReportCallback,
  MetricRatingThresholds,
  ReportOpts,
} from './types.js';

/** Thresholds for FCP. See https://web.dev/fcp/#what-is-a-good-fcp-score */
export const FCPThresholds: MetricRatingThresholds = [1800, 3000];

/**
 * Calculates the [FCP](https://web.dev/fcp/) value for the current page and
 * calls the `callback` function once the value is ready, along with the
 * relevant `paint` performance entry used to determine the value. The reported
 * value is a `DOMHighResTimeStamp`.
 */
export const onFCP = (onReport: FCPReportCallback, opts?: ReportOpts) => {
  // Set defaults
  opts = opts || {};

  whenActivated(() => {
    const visibilityWatcher = getVisibilityWatcher();
    let metric = initMetric('FCP');
    let report: ReturnType<typeof bindReporter>;

    const handleEntries = (entries: FCPMetric['entries']) => {
      (entries as PerformancePaintTiming[]).forEach((entry) => {
        if (entry.name === 'first-contentful-paint') {
          po!.disconnect();

          // Only report if the page wasn't hidden prior to the first paint.
          if (entry.startTime < visibilityWatcher.firstHiddenTime) {
            // The activationStart reference is used because FCP should be
            // relative to page activation rather than navigation start if the
            // page was prerendered. But in cases where `activationStart` occurs
            // after the FCP, this time should be clamped at 0.
            // 有可能有预渲染，这时候需要用激活时间减去FCP时间，如果小于0，就是0
            metric.value = Math.max(entry.startTime - getActivationStart(), 0);
            metric.entries.push(entry);
            report(true);
          }
        }
      });
    };

    const po = observe('paint', handleEntries);

    if (po) {
      report = bindReporter(
        onReport,
        metric,
        FCPThresholds,
        opts!.reportAllChanges
      );

      // Only report after a bfcache restore if the `PerformanceObserver`
      // successfully registered or the `paint` entry exists.
      onBFCacheRestore((event) => {
        // pageshow从cache中打开的时候触发（比如safari的前进后退不会触发PerformanceObserver监听），这时候也要reporter
        metric = initMetric('FCP');
        report = bindReporter(
          onReport,
          metric,
          FCPThresholds,
          opts!.reportAllChanges
        );

        doubleRAF(() => {
          metric.value = performance.now() - event.timeStamp;
          report(true);
        });
      });
    }
  });
};
