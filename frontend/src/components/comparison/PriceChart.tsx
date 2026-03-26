// import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'; // TODO: Re-enable when price history is implemented

interface PriceDataPoint {
  date: string;
  price: number;
}

interface PriceChartProps {
  data: PriceDataPoint[];
  currency: string;
}

// TODO: Re-enable when price history feature is implemented
export const PriceChart = (_props: PriceChartProps) => {
  // Disabled for now - will be re-enabled when price history feature is implemented
  return null;

  // if (!data || data.length < 2) {
  //   return null;
  // }

  // return (
  //   <div className="w-full h-64 mt-4">
  //     <h4 className="text-sm font-medium text-gray-700 mb-2">Price History</h4>
  //     <ResponsiveContainer width="100%" height="100%">
  //       <LineChart data={data}>
  //         <CartesianGrid strokeDasharray="3 3" />
  //         <XAxis
  //           dataKey="date"
  //           tick={{ fontSize: 12 }}
  //         />
  //         <YAxis
  //           tick={{ fontSize: 12 }}
  //           tickFormatter={(value) => `${currency} ${value}`}
  //         />
  //         <Tooltip
  //           formatter={(value: number) => [`${currency} ${value}`, 'Price']}
  //         />
  //         <Line
  //           type="monotone"
  //           dataKey="price"
  //           stroke="#2563eb"
  //           strokeWidth={2}
  //           dot={{ r: 4 }}
  //         />
  //       </LineChart>
  //     </ResponsiveContainer>
  //   </div>
  // );
};
