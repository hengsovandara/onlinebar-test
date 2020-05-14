import React, { useEffect, useState } from 'react';

function Video({ width = "300px", id }) {

  return (
    <video width={width} autoPlay='1' id={id} style={{backgroundColor: 'black', marginLeft: 10}}/>
  );
}

export default Video;
