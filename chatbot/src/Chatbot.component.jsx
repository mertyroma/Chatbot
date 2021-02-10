import React from "react";
import { Launcher } from 'react-chat-window'
import io from 'socket.io-client';

class ChatBotRobot extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            messageList: [],
            socket: io("http://localhost:3000"),
            room: "user1",
        }

    }

    componentDidMount() {
        this.state.socket.connect(true);
        this.state.socket.emit('join', this.state.room);

        this.state.socket.on("send-msg-response", async (msg) => {
            let text = typeof msg !== 'string' ? msg.text : msg;
            let offers = typeof msg === 'object' && msg.hasOwnProperty('hotels') ? msg.hotels : [];

            let offersOutput = offers.map(offer => {
                let address = `${offer.hotel.address.lines[0]}, ${offer.hotel.address.postalCode} ${offer.hotel.address.cityName}, ${offer.hotel.address.countryCode}`;
                let email = offer.hotel.contact.email;
                let phone = offer.hotel.contact.phone
                let description = offer.hotel.description.text;
                let rating = offer.hotel.rating;
                let name = offer.hotel.name;
                let imgUrl = offer.hotel.media.uri;
                let price = offer.offers[0].price.total + ' ' + offer.offers[0].price.currency;
                return `\n${name}\nDescription: ${description}\nAddress: ${address}\n${email ? 'Email: ' + email + '\n' : ''}Phone: ${phone}\nRating: ${rating} \nPrice: ${price}\n`;
            });

            if (offers.length) {
                text += '\n';
                text += offersOutput.join('');
            }

            this.state.messageList.pop();
            await this.setState({
                messageList: [...this.state.messageList]
            })

            this._sendMessage(text);
        })

    }

    async _onMessageWasSent(message) {
        await this.setState({
            messageList: [...this.state.messageList, message]
        })

        this._sendMessage("••••");
        await this.state.socket.emit('new-msg', { msg: message.data.text, room: this.state.room })

    }

    _sendMessage(text) {
        if (text.length > 0) {
            this.setState({
                messageList: [...this.state.messageList, {
                    author: 'them',
                    type: 'text',
                    data: { text }
                },]
            })
        }
    }

    render() {

        return (
            <div id="chatbox" className="chatbox">
                <Launcher
                    agentProfile={{
                        teamName: 'Chatbot',
                        imageUrl: 'https://a.slack-edge.com/66f9/img/avatars-teams/ava_0001-34.png'
                    }}
                    onMessageWasSent={this._onMessageWasSent.bind(this)}
                    messageList={this.state.messageList}
                    showEmoji
                />
            </div>
        );
    }
}

export default ChatBotRobot;
