"use module"
import Defer from "p-defer"

export class AsyncIterPipeDoneError extends Error{
	constructor( asyncIterPipe){
		super("AsyncIterPipeDoneError")
		this.asyncIterPipe= asyncIterPipe
	}
}

const resolved= Promise.resolve()

export const Drop= Symbol.for( "async-iter-pipe:drop")

const ended= Symbol.for( "async-iter-pipe:ended")

let n= 0

export class AsyncIterPipe{
	static DROP = Drop
	static get [ Symbol.species](){
		return Promise
	}

	// note: falsy values commented out

	// state
	done= false
	//value= null
	reads= [] // reads from consumers pending new values
	writes= [] // writes from produce awaiting readers
	//ending= false // wrapping up but not done yet
	tail= resolved
	//map= null

	// stored
	onAbort= null


	readCount= 0
	writecont= 0;
	[ ended]= Defer()

	// modes
	//produceAfterReturn= false
	//strictAsync= false

	constructor( opts){
		this.onAbort= ex=> this.throw( ex)
		if( opts){
			if( opts.signal){
				this.signal= opts.signal
			}
			if( opts.produceAfterReturn){
				this.produceAfterReturn= true
			}
			if( opts.tail|| opts.sloppy){
				this.tail= opts.tail|| null
			}
			if( opts.strictAsync){
				this.strictAsync= true
			}
			if( opts.map){
				this.map= opts.map
			}
		}
	}
	set signal( signal){
		if( this.signal_){
			this.signal_.removeEventListener( this.onAbort)
		}
		this.signal_= signal
		signal.once( this.onAbort, { passive: true})
	}
	get signal(){
		return this.signal_
	}
	/**
	* Return number of stored write values ready to consume,
	* or if negative, the number of read values pending
	*/
	get queueCount(){
		if( this.writes&& this.writes.length){
			return this.writes.length
		}else if( this.reads&& this.reads.length){
			return -this.reads.length
		}else{
			return 0
		}
	}

	/**
	* Fill any outstanding reads, then save further produced values
	*/
	produce( ...vals){
		console.log( "pipe-produce", this.done, this.reads)
		// cannot produce if done
		if( this.done&& !this.reads){
			throw new AsyncIterPipeDoneError( this)
		}

		// resolve as many outstanding reads as we can
		let valPos= 0
		if( this.reads){
			let readPos= 0
			for( ; valPos< vals.length&& readPos< this.reads.length; ++valPos){
				let val= vals[ valPos]
				if( this.map&& !this.producing){
					this.producing= true
					val= this.map( val)
					this.producing= false
					if( val=== Drop){
						continue
					}
					if( readPos>= this.reads.length){
						// map could have produced more values so recheck
						break
					}
				}
				// resolve
				++this.writeCount
				this.reads[ readPos++].resolve( val)
			}
			// remove these now satisfied reads
			if( valPos> 0){
				this.reads.splice( 0, valPos)
			}

			if( valPos=== vals.length){
				// vals are gone!
				if(( this.done|| this.ending)&& this.reads.length=== 0){
					// cleanup, no more reads coming
					delete this.reads
					this.done= true
					if( this.ending){
						queueMicrotask(()=> {
							this.value= this.endingValue
							delete this.endingValue
							if( this.ending&& this.ending.resolve){
								this.ending.resolve({
									done: true,
									value: this.value
								})
							}
						})
					}
				}
				return
			}
		}

		if( this.ending){
			throw new AsyncIterPipeDoneError( this)
		}

		// save remainder into outstanding writes
		for( ; valPos< vals.length; ++valPos){
			let val= vals[ valPos]
			if( this.map&& !this.producing){
				this.producing= true
				val= this.map( vals[ valPos])
				this.producing= false
				if( val=== Drop){
					continue
				}
			}
			++this.writeCount
			this.writes.push( val)
		}
	}
	async produceFrom( iterable, close= false){
		console.log( "pipe-produceFrom")
		for await( let item of iterable|| []){
			this.produce( item)
		}
		if( close){
			this.return( close)
		}
	}

	_nextReturn( fn, value, done= false){
		console.log( "pipe-_nextReturn")
		value= fn? fn(): value
		// synchronous shortcut: no tracking, no resolving needed
		if( !this.tail&& !(value&& value.then)){
			console.log( "pipe-no-tail", value)
			this.value= value
			const
			  iter0= { done, value},
			  iter= this.strictAsync? Promise.resolve( iter0): iter0
			return iter
		}

		// await value & await tail, then set value & return it's IterationResult
		// wouldn't it be cool if?:
		//   a promise that can describe it's dependencies,
		//   have "progress" of getting's value then waiting for tail
		//   perhaps context-runner style resolution
		const
		  oldTail= this.tail,
		  got= (async oldTail=> { //IIFE
			console.log("pipe-got-hello")
			value= await value
			console.log("pipe-got-value")
			if( oldTail){
				console.log("pipe-got-tail")
				await oldTail
			}
				console.log("pipe-got-returning")
			this.value= value
			return {
				done,
				value
			}
		  })( oldTail)
		// set tail if we're doing that
		if( this.tail){
			this.tail= got
			console.log("WAIT", ++n)
			this.tail.then(x=> console.log("FOUND", n, x))
		}
		console.log( "pipe-got-returns")
		return got
	}
	next(){
		console.log( "pipe-next")
		++this.readCount

		// use already produced writes
		// (if ending, flush these out!)
		const hadWrites= this.writes&& this.writes.length
		if( !this.done&& hadWrites){
			console.log( "pipe-next-had-writes")
			return this._nextReturn( null, this.writes.shift())
		}

		// already done, return so
		if( this.done|| this.ending){
			console.log( "pipe-next-already-done")
			// done
			return this._nextReturn(()=> this.value, null, true)
		}

		// queue up a new pending read
		let pendingRead= Defer()
		this.reads.push( pendingRead)
		console.log( "pipe-next-reads-"+ this.reads.length)
		return this._nextReturn( null, pendingRead.promise)
	}

	_end( value, err){
		const reads= this.reads
		delete this.reads
		delete this.writes
		this.done= true
		this.value= value
		this[ ended].resolve()

		if( reads&& reads.length!== 0){
			// special mode that doesn't terminate immediately
			if( this.produceAfterReturn){
				this.ending= Defer()
				this.endingValue= value
				return this.ending.promise
			// fail any existing reads
			}else{
				const err= new AsyncIterPipeDoneError( this)
				for( let read of reads|| []){
					read.reject( err)
				}
			}
		}
		return {
			done: true,
			value
		}
	}

	/**
	* Stop allowing produce, and stop returning already produced values.
	* If 'produceAfterReturn' mode is set, produce will continue to fulfill already issues reads.
	*/
	return( value){
		return this._end( value)
	}
	/**
	* Immediately become done and reject and pending reads.
	*/
	throw( ex){
		return this._end( undefined, ex)
	}
	[ Symbol.iterator](){
		return this
	}
	[ Symbol.asyncIterator](){
		return this
	}
	get ended(){
		return this[ ended]
	}
}
export {
	AsyncIterPipe as default,
	AsyncIterPipe as asyncIterPipe,
	AsyncIterPipeDoneError as asyncIterPipeDoneError,
	AsyncIterPipeDoneError as DoneException,
	AsyncIterPipeDoneError as doneException
}
