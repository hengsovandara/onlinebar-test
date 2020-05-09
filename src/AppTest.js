import React, { useEffect, useState } from 'react';
import JitsiMeetJS from 'lib-jitsi-meet-dist'
import './App.css';

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
  bosh: "https://streaming.onlinebar.code2u.biz/http-bind", // FIXME: use xep-0156 for that
  clientNode: "http://jitsi.org/jitsimeet"
};

function App() {
  const [videos, setVideo] = useState([])
  const [audio, setAudio] = useState([])
  const confOptions = {
    openBridgeChannel: true
  };

  let connection = null;
  let isJoined = false;
  let room = null;

  let localTracks = [];
  const remoteTracks = {};

  useEffect(() => {
    if (JitsiMeetJS) startConference();
    else alert('Jitsi Meet API script not loaded');
  }, []);

  function startConference() {
    try {
      JitsiMeetJS.init(initOptions)
      connection = new JitsiMeetJS.JitsiConnection(null, null, options)
      connection.addEventListener(
        JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED,
        onConnectionSuccess);
      // connection.addEventListener(
      //   JitsiMeetJS.events.connection.CONNECTION_FAILED,
      //   onConnectionFailed);
      // connection.addEventListener(
      //   JitsiMeetJS.events.connection.CONNECTION_DISCONNECTED,
      //   disconnect);

      // JitsiMeetJS.mediaDevices.addEventListener(
      //   JitsiMeetJS.events.mediaDevices.DEVICE_LIST_CHANGED,
      //   onDeviceListChanged);

      connection.connect();

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
              setAudio(audioOutputDevices)
          }
        });
      }
    } catch (error) {
      console.error('Failed to load Jitsi API', error);
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
        setVideo(prev => prev.concat([`localVideo${i}`]))
        console.log("hello iam", document.getElementById(`localVideo${i}`))
        localTracks[i].attach(document.getElementById(`localVideo${i}`));
        // setVideo(i)
      } else {
        // $('body').append(
          // `<audio autoplay='1' muted='true' id='localAudio${i}' />`);
        // localTracks[i].attach($(`#localAudio${i}`)[0]);
      }
      if (isJoined) {
        room.addTrack(localTracks[i]);
      }
    }
  }

  const onConnectionSuccess = () => {
    room = connection.initJitsiConference('conference', confOptions);

    room.on(JitsiMeetJS.events.conference.TRACK_ADDED, onRemoteTrack);
    room.on(JitsiMeetJS.events.conference.TRACK_REMOVED, track => {
      console.log(`track removed!!!${track}`);
    });
    room.on(
      JitsiMeetJS.events.conference.CONFERENCE_JOINED,
      onConferenceJoined);
    room.on(JitsiMeetJS.events.conference.USER_JOINED, id => {
      console.log('user join');
      remoteTracks[id] = [];
      console.log('user join', remoteTracks[id]);
    });
    // // room.on(JitsiMeetJS.events.conference.USER_LEFT, onUserLeft);
    // room.on(JitsiMeetJS.events.conference.TRACK_MUTE_CHANGED, track => {
    //   console.log(`${track.getType()} - ${track.isMuted()}`);
    // });
    // room.on(
    //   JitsiMeetJS.events.conference.DISPLAY_NAME_CHANGED,
    //   (userID, displayName) => console.log(`${userID} - ${displayName}`));
    // room.on(
    //   JitsiMeetJS.events.conference.TRACK_AUDIO_LEVEL_CHANGED,
    //   (userID, audioLevel) => console.log(`${userID} - ${audioLevel}`));
    // room.on(
    //   JitsiMeetJS.events.conference.PHONE_NUMBER_CHANGED,
    //   () => console.log(`${room.getPhoneNumber()} - ${room.getPhonePin()}`));
    room.join();
  }

  function onRemoteTrack(track) {

    if (track.isLocal()) {
      return;
    }
    const participant = track.getParticipantId();
    console.log({participant})
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
      console.log("video participant", id, " ", participant)
      setVideo(prev => prev.concat([id]))
    }
    document.getElementById(id) && track.attach(document.getElementById(id));

    // const id = participant + track.getType() + idx;

    // if (track.getType() === 'video') {
    //   $('body').append(
    //     `<video autoplay='1' id='${participant}video${idx}' />`);
    // } else {
    //   $('body').append(
    //     `<audio autoplay='1' id='${participant}audio${idx}' />`);
    // }
    // track.attach($(`#${id}`)[0]);
  }

  function changeAudioOutput(selected) { // eslint-disable-line no-unused-vars
    JitsiMeetJS.mediaDevices.setAudioOutputDevice(selected.value);
  }

  function onConferenceJoined() {
    console.log('conference joined!');
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
          <div id="audioOutputSelectWrapper">
            Change audio output device
            <select id="audioOutputSelect">
              {
                audio.map(a => (<option value={a.deviceId} >{a.label}</option>))
              }
            </select>
          </div>
          {
            videos.map(video => (<video width="300px" autoplay='1' id={video} />))
          }
        </div>
      </header>
    </div>
  );
}

export default App;
