const {Component} = require("react");
const {render} = require("react-dom");
const j = require("react-jenny");
const {randomInt64, getQueries} = require("../common/util");
const Facilitator = require("../common/rtc-facilitator");
const Game = require("./game");
const {physTarget} = require("./util");
const BMSG = require("../bmsg");
const {Ping, Pong} = require("../common/serial");

class TanksApp extends Component {
	constructor(...args) {
		super(...args);

		this.onConnect = this.onConnect.bind(this);
		this.onData = this.onData.bind(this);

		this.facilitator = new Facilitator();
		this.facilitator.onConnect(this.onConnect);
		this.facilitator.onData(this.onData);
		const queries = getQueries();
		if (queries.roomId) {
			this.join(queries.roomId);
		} else {
			this.create();
		}

		this.state = {
			connected: false,
			isCreator: queries.roomId == null,
			playing: false,
		};
	}
	create() {
		this.roomId = randomInt64(6);
		this.facilitator.createRoom(this.roomId);
		this.linkUrl = location.origin + location.pathname + `?roomId=${this.roomId}`;
	}
	join(data) {
		this.roomId = data;
		this.linkUrl = location.origin + location.pathname + `?roomId=${this.roomId}`;
		this.facilitator.joinRoom(data);
	}
	onData(data) {
		const message = BMSG.parse(data);

		if (message instanceof Pong) {
			const now = Date.now();
			const perf = performance.now();
			const oneWayTime = (now - message.ping) / 2;
			const offset = now - (message.timestamp + oneWayTime);
			this.frameZero = message.frameZero + offset;

			const elapsedSeconds = (now - this.frameZero) / 1000;
			const frameNumber = elapsedSeconds / physTarget;
			this.frame = Math.floor(frameNumber);
			const msAgo = (frameNumber - this.frame) / physTarget;
			this.timestamp = perf - msAgo;
			this.setState({connected: true});
			this.facilitator.offData(this.onData);
		}
	}
	onConnect() {
		if (this.state.isCreator) {
			this.setState({connected: true});
			this.facilitator.offData(this.onData);
		} else {
			// make sure the other side is ready to respond quickly
			setTimeout(() => {
				this.facilitator.peers[0].send(BMSG.bytify(new Ping()));
			}, 100);
		}
	}
	renderWaitArea() {
		if (!this.state.isCreator) {
			return j({div: 0}, [
				"connecting to peers...",
				j({br: 0}),
				this.state.error,
			]);
		}

		return j({div: 0}, [
			j({a: {href: this.linkUrl}}, [this.roomId]),
			j({br: 0}),
			j({br: 0}),
			j({div: 0}, ["send the above link to someone else to connect"]),
			j({br: 0}),
			this.state.error,
		]);
	}
	render() {
		if (!this.state.connected) {
			return this.renderWaitArea();
		}

		return j([Game, {
			facilitator: this.facilitator,
			frameZero: this.frameZero,
			id: this.facilitator.id,
			initialFrame: this.frame,
			initialTimestamp: this.timestamp,
			roomId: this.roomId,
		}]);
	}
}

render(j(TanksApp), document.getElementById("react-root"));
