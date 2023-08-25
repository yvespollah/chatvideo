
let APP_ID = "6a2ccef17f8b4e0b9f197572d5c49ac2"

let token = null;
let uid = String(Math.floor(Math.random() * 10000))

let client;// cette variable c'est va contenir un instance de notre serveur agora pour etablire a connxion pour que les utilisateur peuvent se connecter 
let channel;

//ici on va recupere le code pour se connecte a un meme direct

let queryString = window.location.search
let urlParams = new URLSearchParams(queryString)
let code = urlParams.get('room')

//ici on verifie que si il na pas de code, il seras rediriger ver la page de connxion ou il doit entrer le code
if(!code){
    window.location = 'page.html'
}

let localStream;
let remoteStream;
let peerConnection;

// ------------mettre le serveur en place-----------------------------------
const servers = {
    iceServers:[
        {
            urls:['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
}


// ---------------demande d'acces a ma camera et audio---------------------------------- 
let init = async () => {

    // --------------nous allons cree une instance de AgoraATM,puis cette personne va se login et joindre la reunion

    client = await AgoraRTM.createInstance(APP_ID)
    await client.login({uid, token})

    channel = client.createChannel(code)
    await channel.join()

   
    channel.on('MemberJoined', handleUserJoined)// evenement qui va se produire pour  nous dire qune nouvel personne a rejoint la reunion
    
    // cette evenement va sexecuter quand une personne se deconnecte . il va servire a faire disparaitre l'ecran de cette personne
    channel.on('MemberLeft', handleUserLeft)

    //evenement qui va sexecuter voir voir le message dune personne

    client.on('MessageFromPeer', handleMessageFromPeer)

    

// -------------------------------------------------------------------------------------------
    const constraints = { video: true, audio: true };
    localStream = await navigator.mediaDevices.getUserMedia(constraints)
    document.getElementById('user1').srcObject = localStream

    

}

// la fonction qui va sexecuter pour nous montrer le message envoyer par une pair 
let handleMessageFromPeer = async (message, MemberId) => {
    message = JSON.parse(message.text)
    
    if(message.type === 'offer'){
                createAnswer(MemberId, message.offer)
            }
    // ici on va executer la reponse recus    
    if(message.type === 'answer'){
        addAnswer(message.answer)
    }
    //ici on envoie les ice candidate que on a cree
     if(message.type === 'candidate'){
         if(peerConnection){
                peerConnection.addIceCandidate(message.candidate)
            }
        }


}

//la fonction qui a executer pour que quand tu quite la reunion,ton ecran disparait

let handleUserLeft = (MemberId) => {
    document.getElementById('user2').style.display = 'none'
    document.getElementById('user1').classList.remove('smallFrame')
    //  
}

// la fonction qui va s'executer pour nous prevenir que un nouveux utilisateur a rejoin la reunion. nous alonns appeller cette fonctio  dans le init()

let handleUserJoined = async (MemberId) => {
    console.log('Un nouveau membre a rejoin le chat:', MemberId)
    createOffer(MemberId)
    
}

// -----------------connexion avec l'autre personne connecter-----------------------------------

let createPeerConnection = async(MemberId) => {
    peerConnection = new RTCPeerConnection(servers) // cree un objet RTCpeerConnection pour la communication en temps reel

    //-------on recupere les medias d'une personne connecter et on envoit 
    remoteStream = new MediaStream()
    document.getElementById('user2').srcObject = remoteStream
    // ici on veux que c'est quand la deuxieme personne se connecte que sont ecran aparait 
    document.getElementById('user2').style.display = 'block'
    document.getElementById('user1').classList.add('smallFrame')

    //------------- ici nous alons cree le flux local ici si il narive pas a recupere les track du flux cree dans la fonction init----
    if(!localStream){
               localStream = await navigator.mediaDevices.getUserMedia({video:true, audio:false})
               document.getElementById('user1').srcObject = localStream
           }

   //--------envoyer notre media RTCpeerConnection  pour que lautre personne connecter recoit c'est information la-------
   localStream.getTracks().forEach((track) => {
       peerConnection.addTrack(track, localStream)
      })

      // ajouter les media de lautre pair a l'objet RTCpeerConnection a chaque fois pour suivre sa sur mon ecran

       peerConnection.ontrack = (event) => {
          event.streams[0].getTracks().forEach((track) => {
              remoteStream.addTrack(track)
          })
      }


        // -----------------------creation des ice candidate----------------------------------------------------------------
        peerConnection.onicecandidate = async (event) => {
            if(event.candidate){
             client.sendMessageToPeer({text:JSON.stringify({'type':'candidate', 'candidate':event.candidate})}, MemberId)
            }
        }

}

//---------------ici on va cree une offre-------------------------------------------------------

let createOffer = async (MemberId) => {
    
    await createPeerConnection(MemberId) // on appele maintenent la fonction peerConnection
    //  ------cree une offre--------------
    let offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

        // ici on envoir un message a une paire et sont ID
        client.sendMessageToPeer({text:JSON.stringify({'type':'offer', 'offer':offer})}, MemberId)       

}

let createAnswer = async (MemberId, offer) => {
    await createPeerConnection(MemberId)

    await peerConnection.setRemoteDescription(offer)

    let answer = await peerConnection.createAnswer() // la deuxieme personne connecter cree une reponse pour envoyer a la premiere personne
    await peerConnection.setLocalDescription(answer)

    // la reponse qui seras envoyer au premiere paire
    client.sendMessageToPeer({text:JSON.stringify({'type':'answer', 'answer':answer})}, MemberId)
}

//-------------dans cette fonction la premiere paire doit repondre a la reponse de la pair distant
let addAnswer = async (answer) => {
    if(!peerConnection.currentRemoteDescription){ // ici on verifie si la description distant n'est pas definit si oui on la cree
        peerConnection.setRemoteDescription(answer)
    }
}

//----fonction a executer pour quiter la chaine---------------------------------------
let leaveChannel = async () => {
    await channel.leave()
    await client.logout()
}

// ici on va controller notre camera
let toggleCamera = async () => {
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video')

    if(videoTrack.enabled){
        videoTrack.enabled = false
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255, 80, 80)'
    }else{
        videoTrack.enabled = true
        document.getElementById('camera-btn').style.backgroundColor = 'rgba(71, 227, 23, 0.9)'
    }
}

//ici on va controller l'audio
let toggleMic = async () => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')

    if(audioTrack.enabled){
        audioTrack.enabled = false
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)'
    }else{
        audioTrack.enabled = true
        document.getElementById('mic-btn').style.backgroundColor = 'rgba(71, 227, 23, 0.9)'
    }
}

// cette evenement va nous permetre dexecuter la fonction leaveChannel lorseque longlet du navigateur est fermer
window.addEventListener('beforeunload', leaveChannel)


document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('mic-btn').addEventListener('click', toggleMic)

init()