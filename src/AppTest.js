import React, { useEffect, useState } from 'react';
import JitsiMeetJS from 'lib-jitsi-meet-dist'
import './App.css';
import Video from './Video'

const initOptions = {
  disableAudioLevels: true,
  desktopSharingChromeExtId: 'mbocklcggfhnbahlnepmldehdhpjfcjp',
  desktopSharingChromeDisabled: false,
  desktopSharingChromeSources: ['screen', 'window'],
  desktopSharingChromeMinExtVersion: '0.1',
  desktopSharingFirefoxDisabled: true
};

const options = {
  hosts: {
    domain: "streaming.onlinebar.code2u.biz",
    muc: "conference.streaming.onlinebar.code2u.biz" // FIXME: use XEP-0030
  },
  // bosh: "https://streaming.onlinebar.code2u.biz/http-bind", // FIXME: use xep-0156 for that
  serviceUrl: "wss://streaming.onlinebar.code2u.biz/xmpp-websocket",
  clientNode: "http://jitsi.org/jitsimeet"
};

function App() {
  const [videos, setVideo] = useState([])
  const [optionAudio, setOptionAudio] = useState([])
  const [audios, setAudios] = useState([])
  const [currentRoom, setCurrentRoom] = useState({})
  const [participants, getParticipants] = useState({ host: {}, members: []})

  const confOptions = {
    openBridgeChannel: true
  };

  let connection = null;
  let isJoined = false;
  let room = null;

  let localTracks = [];
  const remoteTracks = {};

  async function startConference(roomName) {
    try {
      JitsiMeetJS.init(initOptions)
      connection = new JitsiMeetJS.JitsiConnection(null, null, options)
      connection.addEventListener(
        JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED,
        () => onConnectionSuccess(roomName));
      // connection.addEventListener(
      //   JitsiMeetJS.events.connection.CONNECTION_FAILED,
      //   onConnectionFailed);
      // connection.addEventListener(
      //   JitsiMeetJS.events.connection.CONNECTION_DISCONNECTED,
      //   disconnect);

      // JitsiMeetJS.mediaDevices.addEventListener(
      //   JitsiMeetJS.events.mediaDevices.DEVICE_LIST_CHANGED,
      //   onDeviceListChanged);

      await connection.connect();

      setTimeout( () => {
        createLocalTracks()
      }, 2000)
      
    } catch (error) {
      console.error('Failed to load Jitsi API', error);
    }
  }

  function createLocalTracks(){
    JitsiMeetJS.createLocalTracks({ devices: ['audio', 'video'] })
      .then(onLocalTracks)
      .catch(error => {
        throw error;
      });

    if (JitsiMeetJS.mediaDevices.isDeviceChangeAvailable('output')) {
      JitsiMeetJS.mediaDevices.enumerateDevices(devices => {
        const audioOutputDevices
          = devices.filter(d => d.kind === 'audiooutput');

        if (audioOutputDevices.length > 1) {
          setOptionAudio(audioOutputDevices)
        }
      });
    }
  }

  function onLocalTracks(tracks) {
    localTracks = tracks;
    for (let i = 0; i < localTracks.length; i++) {
      localTracks[i].addEventListener(
        JitsiMeetJS.events.track.TRACK_AUDIO_LEVEL_CHANGED,
        audioLevel => console.log(`Audio Level local: ${audioLevel}`));
      localTracks[i].addEventListener(
        JitsiMeetJS.events.track.TRACK_MUTE_CHANGED,
        () => console.log('local track muted'));
      localTracks[i].addEventListener(
        JitsiMeetJS.events.track.LOCAL_TRACK_STOPPED,
        () => console.log('local track stoped'));
      localTracks[i].addEventListener(
        JitsiMeetJS.events.track.TRACK_AUDIO_OUTPUT_CHANGED,
        deviceId =>
          console.log(
            `track audio output device was changed to ${deviceId}`));
      if (localTracks[i].getType() === 'video') {
        let isHost = room ? room.getRole() === 'moderator' : false
        if (isHost){
          getParticipants(prev => ({...prev, host: `localVideo1`}))
        }else{
          getParticipants(prev => {
            let prevMembers = prev.members
            prevMembers = !prevMembers.includes(`localVideo1`) ? prevMembers.concat([`localVideo1`]) : []
            return{
              ...prev,
              members: prevMembers
            }
          })
        }
        localTracks[1].attach(document.getElementById(`localVideo1`));
      } else {
        setAudios(prev => prev.concat([`localAudio${i}`]));
        localTracks[i].attach(document.getElementById(`localAudio${i}`))
      }
      if (isJoined) {
        room.addTrack(localTracks[i]);
      }
    }
  }

  const onConnectionSuccess = (roomName = 'conference') => {

    room = connection.initJitsiConference(roomName, confOptions);

    room.on(JitsiMeetJS.events.conference.TRACK_ADDED, onRemoteTrack);
    room.on(JitsiMeetJS.events.conference.TRACK_REMOVED, track => {
      console.log(`track removed!!!${track}`);
      onRemoveTrack(track)
    });
    room.on(
      JitsiMeetJS.events.conference.CONFERENCE_JOINED,
      onConferenceJoined);
    room.on(JitsiMeetJS.events.conference.USER_JOINED, id => {
      remoteTracks[id] = [];
    });
    room.on(JitsiMeetJS.events.conference.USER_LEFT, onUserLeft);
    room.on(JitsiMeetJS.events.conference.TRACK_MUTE_CHANGED, track => {
      console.log(`${track.getType()} - ${track.isMuted()}`);
    });
    room.on(
      JitsiMeetJS.events.conference.DISPLAY_NAME_CHANGED,
      (userID, displayName) => console.log(`${userID} - ${displayName}`));
    room.on(
      JitsiMeetJS.events.conference.TRACK_AUDIO_LEVEL_CHANGED,
      (userID, audioLevel) => console.log(`${userID} - ${audioLevel}`));
    room.on(
      JitsiMeetJS.events.conference.PHONE_NUMBER_CHANGED,
      () => console.log(`${room.getPhoneNumber()} - ${room.getPhonePin()}`));
    room.join();
  }

  function onRemoveTrack(track){
    if (track.isLocal()) {
      return;
    }
    
    const participant = track.getParticipantId();

    if (remoteTracks[participant]) {
      delete remoteTracks[participant];
      setVideo(prev => prev.filter(id => !id.includes(participant)))
    }
  }

  function onRemoteTrack(track) {

    if (track.isLocal()) {
      return;
    }

    const participant = track.getParticipantId();

    if (!remoteTracks[participant]) {
      remoteTracks[participant] = [];
    }
    const idx = remoteTracks[participant].push(track);

    track.addEventListener(
      JitsiMeetJS.events.track.TRACK_AUDIO_LEVEL_CHANGED,
      audioLevel => console.log(`Audio Level remote: ${audioLevel}`));
    track.addEventListener(
      JitsiMeetJS.events.track.TRACK_MUTE_CHANGED,
      () => console.log('remote track muted'));
    track.addEventListener(
      JitsiMeetJS.events.track.LOCAL_TRACK_STOPPED,
      () => console.log('remote track stoped'));
    track.addEventListener(JitsiMeetJS.events.track.TRACK_AUDIO_OUTPUT_CHANGED,
      deviceId =>
        console.log(
          `track audio output device was changed to ${deviceId}`));
    const id = participant + track.getType() + idx;

    if (track.getType() === 'video') {
      let isHost = room && room.getParticipantById(participant).getRole() === 'moderator' || false

      if (isHost) {
        getParticipants(prev => ({ ...prev, host: id }))
      } else {
        getParticipants(prev => {
          let prevMembers = prev.members
          prevMembers = !prevMembers.includes(id) ? prevMembers.concat([id]) : []
          return {
            ...prev,
            members: prevMembers
          }
        })
      }
    }else{
      setAudios(prev => prev.concat(prev.includes(id) ? [] : [id]));
    }
    document.getElementById(id) && track.attach(document.getElementById(id));
  }

  function onUserLeft(id) {
    let isHost = room && room.getParticipantById(id).getRole() === 'moderator' || false

    if (isHost)
      connection.disconnect()

    if (!remoteTracks[id]) {
      return;
    }
    const tracks = remoteTracks[id];

    for (let i = 0; i < tracks.length; i++) {
      const idx = `#${id}${tracks[i].getType()}`
      document.getElementById(idx) && tracks[i].detach(document.getElementById(idx));
    }
  }

  function changeAudioOutput(selected) { // eslint-disable-line no-unused-vars
    JitsiMeetJS.mediaDevices.setAudioOutputDevice(selected.value);
  }

  function onConferenceJoined(event) {
    isJoined = true;
    for (let i = 0; i < localTracks.length; i++) {
      room.addTrack(localTracks[i]);
    }
  }
  
  return (
    <div className="App">
      <header className="App-header">
        <div
          id="jitsi-container"
          style={{ display: 'block', width: '100%', height: '100%', }}
        >
          <button onClick={() => startConference('dara')}>Create room</button>
          <button onClick={() => startConference("dara")}>Join</button>

          <Video id={participants.host} width="400px"/>
          <Video id={participants.members[0]} />
          <Video id={participants.members[1]} />
          <Video id={participants.members[2]} />
          <Video id={participants.members[3]} />
          <Video id={participants.members[4]} />
          <Video id={participants.members[5]} />
          <Video id={participants.members[6]} />
          <Video id={participants.members[7]} />
          <Video id={participants.members[8]} />
          {
            audios.map(audio => (<audio autoPlay='1' muted={true} id={audio} />))
          }
        </div>
      </header>
    </div>
  );
}

export default App;
