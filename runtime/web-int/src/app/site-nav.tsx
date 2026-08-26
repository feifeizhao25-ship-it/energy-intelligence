'use client';import Link from 'next/link';import {useState} from 'react';
const links:[string,string][]=[['Workspace','/'],['Assessment','/assessment'],['Evidence','/evidence'],['Pricing','/pricing'],['Sign in','/login']];
export default function SiteNav(){const[open,setOpen]=useState(false);return <>
<button className="menu-button" aria-label={open?'Close navigation menu':'Open navigation menu'} aria-expanded={open} onClick={()=>setOpen(v=>!v)}><span/><span/><span/></button>
<nav className={open?'open':''}>{links.map(([label,href])=><Link key={href} href={href} onClick={()=>setOpen(false)}>{label}</Link>)}</nav>
</>}
