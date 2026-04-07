import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { formatInCrores } from '../utils/formatUtils';

const CHART_HEIGHT = 300;

/**
 * Labels render in a left column (uses card padding / empty space).
 * Chart has Y-axis hidden so long stage names never overlap bars.
 */
export default function LeadConversionFunnelChart({ funnelData }) {
  if (!Array.isArray(funnelData) || funnelData.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-8">No funnel data</p>;
  }

  return (
    <div
      className="flex gap-2 sm:gap-3 w-full min-w-0 items-stretch"
      style={{ height: CHART_HEIGHT }}
    >
      <div
        className="flex flex-col flex-shrink-0 w-[min(46%,240px)] sm:w-[260px] pl-0 pr-2 text-right"
        style={{ height: CHART_HEIGHT }}
      >
        {funnelData.map((row) => (
          <div
            key={row.name}
            className="flex-1 flex items-center justify-end min-h-0 py-0.5"
          >
            <span
              className="text-[11px] sm:text-xs text-slate-600 font-medium leading-snug break-words hyphens-auto max-w-full"
              title={row.name}
            >
              {row.name}
            </span>
          </div>
        ))}
      </div>
      <div className="flex-1 min-w-0 h-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={funnelData}
            margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" hide />
            <Tooltip
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
              formatter={(value) => formatInCrores(value)}
              labelFormatter={(label) => label}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
              {funnelData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
