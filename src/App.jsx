import { useState } from 'react'
import OperationalPortal from './components/OperationalPortal.jsx'
import Observatory from './components/Observatory.jsx'
export default function App(){
 const [privateView,setPrivateView]=useState(false)
 return privateView ? <><button className="portal-return" onClick={()=>setPrivateView(false)}>Volver al observatorio</button><OperationalPortal/></> : <Observatory onLogin={()=>setPrivateView(true)}/>
}
