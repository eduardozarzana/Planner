import React from 'react';

interface IllustrationProps {
  className?: string;
}

export const NotFoundIllustration: React.FC<IllustrationProps> = ({ className = "w-full max-w-md h-auto" }) => (
  <svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg" className={className} aria-labelledby="notFoundTitleDesc" role="img">
    <title id="notFoundTitleDesc">Ilustração de página não encontrada. Um personagem confuso ao lado do número 404.</title>
    
    {/* "404" Text */}
    <text 
      x="155"  // Adjusted x for better centering with character
      y="100" 
      fontFamily="Inter, Arial, sans-serif" 
      fontSize="90" 
      fontWeight="bold" 
      fill="#a3e635" /* lime-400 */
      textAnchor="middle"
    >
      4<tspan fill="#facc15" /* yellow-400 for the '0' */>0</tspan>4
    </text>

    {/* Simple Character - very abstract */}
    {/* Head */}
    <circle cx="70" cy="75" r="15" fill="#d9f99d" /* lime-200 */ stroke="#4d7c0f" /* green-800 */ strokeWidth="2"/>
    {/* Body */}
    <line x1="70" y1="90" x2="70" y2="130" stroke="#4d7c0f" strokeWidth="2"/>
    {/* Arms shrugging */}
    <line x1="70" y1="100" x2="50" y2="115" stroke="#4d7c0f" strokeWidth="2"/>
    <line x1="70" y1="100" x2="90" y2="115" stroke="#4d7c0f" strokeWidth="2"/>
    {/* Legs */}
    <line x1="70" y1="130" x2="55" y2="150" stroke="#4d7c0f" strokeWidth="2"/>
    <line x1="70" y1="130" x2="85" y2="150" stroke="#4d7c0f" strokeWidth="2"/>

    {/* Optional: speech bubble with "?" */}
    <g transform="translate(0 -5)"> {/* Move speech bubble slightly up */}
      <ellipse cx="45" cy="55" rx="10" ry="7" fill="#fefce8" /* yellow-50 */ stroke="#ca8a04" /* yellow-500 */ strokeWidth="1.5"/>
      <text x="45" y="58" fontFamily="Arial" fontSize="10" fill="#ca8a04" textAnchor="middle">?</text>
    </g>
    
  </svg>
);

export default NotFoundIllustration;
