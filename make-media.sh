#!/bin/bash

ffmpeg \
  -i ../Wizard\ People/tmp/WizardPeople-video.mp4 \
  -i ../Wizard\ People/tmp/WizardPeople-audio-original-surround.mp4 \
  -map 0:0 \
  -map 1:0 \
  -c:v copy -c:a copy \
  -y media/HP-surround.mp4

ffmpeg \
  -i ../Wizard\ People/tmp/WizardPeople-video.mp4 \
  -i ../Wizard\ People/tmp/WizardPeople-audio-original-stereo.mp4 \
  -map 0:0 \
  -map 1:0 \
  -c:v copy -c:a copy \
  -y media/HP-stereo.mp4

ffmpeg \
  -i ../Wizard\ People/tmp/WizardPeople-audio-2005-stereo.mp4 \
  -y media/WizardPeople.mp3
