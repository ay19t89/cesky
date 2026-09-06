import type {Metadata} from 'next';
import './globals.css';
import './filters.css';
export const metadata:Metadata={title:'České pády — osobní slovník',icons:{icon:'/favicon.svg'},description:'Skloňování českých podstatných jmen ze dvou zdrojů. Soukromý slovník a exporty.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="cs"><body>{children}</body></html>}

