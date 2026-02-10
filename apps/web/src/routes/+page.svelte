<script>
  import configState from "$lib/state/config.svelte";
</script>

<div class="h-80 flex justify-center items-end home_div">
  <div class="text-8xl font-mono font-extrabold">
    <img src="https://disorientation.cssa.club/files/logo-web-v2.gif" alt="Welcome to DisorientationCTF">
  </div>
  <div class="home_info_div">
    <div class="home_info_div_left text-l press-start-2p">
      The premier student-led CTF of ANU!
      <br><br>
      Feb 18, 12pm<br>
      |<br>
      Feb 22, 3pm
    </div>
    <div class="home_button_div">
      <a href="/challenges" class="btn btn-primary text-2xl press-start-2p home_button_challenges">Challenges</a>
      <a href="/team" class="btn btn-accent text-2xl press-start-2p home_button_teamup">Team Up</a>
    </div>
  </div>
  <div class="sponsors_div press-start-2p">
    <span>Sponsored by</span>
    <a href="https://tantosec.com/">
      <img src="https://disorientation.cssa.club/files/tantosec.png" alt="TantoSec - sharper cyber security"/>
    </a>
  </div>
</div>
