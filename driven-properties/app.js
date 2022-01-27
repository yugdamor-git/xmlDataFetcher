var fs = require("fs");
const axios = require("axios");
const FormData = require('form-data');
const path = require("path")
const parseString = require("xml2js").parseString;

let backup_dir = "./backup";

let file_path = backup_dir + "/data.json";

let img_dir = "./images"

const strapi_endpoint = "http://localhost:1337"
const strapi_token = ""
const xml_url = "https://crm.drivenproperties.ae/portals/xml/driven.xml"


if (!fs.existsSync(backup_dir)) {
  fs.mkdirSync(backup_dir);
}

if (!fs.existsSync(img_dir)) {
  fs.mkdirSync(img_dir);
}



main();


async function main() {

    let new_listings = await downloadXmlListings()
    console.log(`total listings in xml file : ${new_listings.length}`)
    if (!fs.existsSync(file_path)) 
    {
        console.log(`old file does not exists`)
        await saveFile(new_listings);

        insert(new_listings)

    }
    else
    {
        let file_data = fs.readFileSync(file_path, "utf8");
        let old_listings = JSON.parse(file_data);
        saveFile(new_listings);

        let listings = await compare(old_listings,new_listings)
        let update_listings = listings["update"]
        let insert_listings = listings["insert"]

        console.log(`total listings that needs to be updated : ${update_listings.length}`)
        console.log(`total listings that needs to be inserted : ${insert_listings.length}`)

        insert(insert_listings)

        update(update_listings)

    }



}

async function update(listings)
{
    for(let index=0;index<=listings.length;index++)
    {
        const listing = listings[index]

        const ref_num = listing["Property_Ref_No"]

        const id = await get_listing_id(ref_num)

        let url = `${strapi_endpoint}/api/listings/${id}`;

        let response = await axios({
            url:url,
            method:"PUT",
            data:{
                "data":listing
            },
            headers:{
              "Authorization":`Bearer ${strapi_token}`
            }
        })

        console.log(response.status)

        console.log(`updated : ${response.data.data.id}`)
    }
    
}

async function get_listing_id(ref_num)
{
    let url = `${strapi_endpoint}/api/listings?filters[Property_Ref_No][$eq]=${ref_num}&fields=id`;

    let response = await axios({
        url:url,
        method:"GET",
        headers:{
          "Authorization":`Bearer ${strapi_token}`
        }
    })
    
    return response.data.data[0]["id"]
    
}

async function insert(listings)
{

    for(var index =0; index <= listings.length; index ++)
    {
        try
        {
            process_listing(listings,index)
        }
        catch
        {

        }
        

    }

}

async function process_listing(listings,index)
{
    try
    {
        let listing = listings[index]["listing"];
    let images = listings[index]["images"];
    console.log(`processing : ${listing["Property_Ref_No"]}`)
    console.log(`total images : ${images.length}`)

    let listing_id = await insert_into_db(listing)

    for(var img_index=0;img_index <= images.length; img_index++)
    {
        try
        {
            await downloadImage(images[img_index],listing_id,img_index)
            await uploadToCms(listing_id,img_index)
            
            

        }
        catch(err)
        {
            console.log(`failed to download image : ${images[img_index]}`)
            console.log(`error : ${err}`)
        }
        
        
    }
    }
    catch
    {
        
    }
    
}

async function uploadToCms(listing_id,index)
{
    let url = `${strapi_endpoint}/api/upload`

    const form = new FormData();

    const file =  fs.createReadStream(`./images/${listing_id}-${index}.png`)
    
    form.append("refId",listing_id)
    form.append("ref","api::listing.listing")
    form.append("field","images")

    form.append(`files`,file,`${listing_id}-${index}.png`)

    let response = await axios.post(
        url,
        form,
        {
          headers:{
            "Authorization":`Bearer ${strapi_token}`
          }
        }
    )

    console.log(response.status)

}

async function downloadImage(url,listing_id,index)
{
    const imgPath = path.resolve(__dirname,'images',`${listing_id}-${index}.png`)

    const writer = fs.createWriteStream(imgPath)

    let image_content = await axios({
        url: url,
        method:"GET",
        responseType:'stream'
    })

    image_content.data.pipe(writer)

    console.log(`image downloaded : ${listing_id}-${index}.png`)

    return new Promise((resolve,reject) => {
        writer.on("finish",resolve)
        writer.on('error',reject)
    })

}

async function insert_into_db(listing)
{
    let url = `${strapi_endpoint}/api/listings`;

    let response = await axios({
        url:url,
        method:"POST",
        data:{
            "data":listing
        },
        headers:{
          "Authorization":`Bearer ${strapi_token}`
        }
    })

    console.log(response.status)

    return response.data.data.id
}

async function compare(old_listings, new_listings) {
    let insert_listings = [];
    let update_listings = []; 
  
    let old_listing_dict = {};
  
    old_listings.forEach((item) => {
      old_listing_dict[item["listing"]["Property_Ref_No"]] = item;
    });
  
    new_listings.forEach((new_item) => {
      try {
        let old_listing = old_listing_dict[new_item["listing"]["Property_Ref_No"]];
  
        if (JSON.stringify(new_item["listing"]) == JSON.stringify(old_listing["listing"])) {
          console.log(`No Change : ${new_item["listing"]["Property_Ref_No"]}`);
        } else {
          console.log(`Changed : ${new_item["listing"]["Property_Ref_No"]}`);
          update_listings.push(new_item)

        }
      } catch (err) {
        insert_listings.push(new_item)
      }
    });
  
    return {
        "update":update_listings,
        "insert":insert_listings
    }
  }

async function saveFile(parsed_listings) {
    fs.writeFile(file_path, JSON.stringify(parsed_listings), (err) => {
      if (err) {
        console.log(`error : ${err}`);
      } else {
        console.log(`file saved : ${file_path}`);
      }
    });
  }


async function downloadXmlListings()
{
    const xml_res = await axios.get(xml_url)
    
    const data = xml_res.data;

    let xml_str = new Buffer.from(data).toString();

    let parsed_listings = [];

    parseString(xml_str, { trim: true },(err, parsed_data) => {

        for(listing of parsed_data["Listings"]["Listing"])
        {
            let parsed = parse_listing(listing);
            parsed_listings.push(parsed);
        }
       
    

    
})
return parsed_listings
}


function parse_listing(listing) {
    let temp = {};
    let images = [];
    for (const [key, v] of Object.entries(listing)) {
      let value = v[0];
  
      if (key == "Listing_Date" || key == "Last_Updated") {
        temp[key] = new Date(value);
      } else if (key == "Images") {
        
        try {
          value["image"].forEach((image) => {
            images.push(image);
          });
        } catch (err) {
          console.log(`images : ${err}`);
        }
  
        
        //  image
      } else if (key == "Facilities") {
        let facilities = [];
        try {
          value["facility"].forEach((facility) => {
            facilities.push(facility);
          });
        } catch (err) {
          console.log(`facility : ${err}`);
        }
        temp[key] = facilities;
        //  facility
      } else if (
        key == "count" ||
        key == "Unit_Builtup_Area" ||
        key == "No_of_Bathroom" ||
        key == "Bedrooms" ||
        key == "Price" ||
        key == "No_of_Rooms" ||
        key == "Parking"
      ) {
        try {
          temp[key] = parseInt(value);
        } catch (err) {
          temp[key] = null;
        }
      } else {
        temp[key] = value;
      }
    }
  
    return {"listing":temp,"images":images};
  }