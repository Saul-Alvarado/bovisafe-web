import { useState } from 'react'
import OperationalPortal from './components/OperationalPortal.jsx'
import Observatory from './components/Observatory.jsx'
export default function App(){
 const [privateView,setPrivateView]=useState(false)
 return privateView ? <OperationalPortal onExit={()=>setPrivateView(false)}/> : <Observatory onLogin={()=>setPrivateView(true)}/>
}
