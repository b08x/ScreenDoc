/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
// Copyright 2024 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {max, min} from 'd3-array';
import {scaleBand, scaleLinear} from 'd3-scale';
import {line} from 'd3-shape';
import {useEffect, useRef, useState} from 'react';
import {timeToSecs} from './utils';

// FIX: Define an interface for the chart data points for type safety.
interface ChartDataPoint {
  time: string;
  value: number | string;
}

// FIX: Add types for component props.
export default function Chart({
  data,
  yLabel,
  jumpToTimecode,
}: {
  data: ChartDataPoint[];
  yLabel: string;
  jumpToTimecode: (seconds: number) => void;
}) {
  // FIX: Provide a specific element type to useRef for type safety.
  const chartRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(1);
  const [height, setHeight] = useState(1);
  const margin = 55;
  const xMax = width;
  const yMax = height - margin;
  // FIX: Add generic type to scaleBand for type safety.
  const xScale = scaleBand<string>()
    .range([margin + 10, xMax])
    .domain(data.map((d) => d.time))
    .padding(0.2);

  // FIX: Coerce data values to numbers for use in linear scale.
  const vals = data.map((d) => +d.value);
  const yScale = scaleLinear()
    // FIX: Handle cases where min/max might be undefined (e.g., empty data array).
    .domain([min(vals) ?? 0, max(vals) ?? 1])
    .nice()
    .range([yMax, margin]);

  const yTicks = yScale.ticks(Math.floor(height / 70));

  // FIX: Specify the data type for the line generator to fix property access errors.
  const lineGen = line<ChartDataPoint>()
    .x((d) => xScale(d.time)!)
    .y((d) => yScale(+d.value));

  useEffect(() => {
    const setSize = () => {
      // FIX: Add a null check before accessing the ref's current property.
      if (chartRef.current) {
        setWidth(chartRef.current.clientWidth);
        setHeight(chartRef.current.clientHeight);
      }
    };

    setSize();
    addEventListener('resize', setSize);
    return () => removeEventListener('resize', setSize);
  }, []);

  return (
    <svg className="lineChart" ref={chartRef}>
      <g className="axisLabels" transform={`translate(0 ${0})`}>
        {yTicks.map((tick) => {
          const y = yScale(tick);

          return (
            <g key={tick} transform={`translate(0 ${y})`}>
              <text x={margin - 10} dy="0.25em" textAnchor="end">
                {tick}
              </text>
            </g>
          );
        })}
      </g>

      <g
        className="axisLabels timeLabels"
        transform={`translate(0 ${yMax + 40})`}>
        {data.map(({time}, i) => {
          return (
            <text
              key={i}
              x={xScale(time)}
              role="button"
              onClick={() => jumpToTimecode(timeToSecs(time))}>
              {time.length > 5 ? time.replace(/^00:/, '') : time}
            </text>
          );
        })}
      </g>

      <g>
        {/* FIX: Handle null return from lineGen */}
        <path d={lineGen(data) || ''} />
      </g>

      <g>
        {data.map(({time, value}, i) => {
          return (
            <g key={i} className="dataPoint">
              {/* FIX: Coerce value to number for yScale */}
              <circle cx={xScale(time)} cy={yScale(+value)} r={4} />

              {/* FIX: Coerce value to number for yScale */}
              <text x={xScale(time)} y={yScale(+value) - 12}>
                {value}
              </text>
            </g>
          );
        })}
      </g>

      <text
        className="axisTitle"
        x={margin}
        y={-width + margin}
        transform="rotate(90)">
        {yLabel}
      </text>
    </svg>
  );
}
