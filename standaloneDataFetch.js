var fs = require("fs");
const axios = require("axios");

const parseString = require("xml2js").parseString;

let backup_dir = "./backup";

let file_path = backup_dir + "/data.json";

if (!fs.existsSync(backup_dir)) {
  fs.mkdirSync(backup_dir);
}
//

//

main();

function main() {
  axios
    .get("https://crm.drivenproperties.ae/portals/xml/driven.xml")
    .then((resp) => {
      const data = resp.data;

      let xml_str = new Buffer.from(data).toString();

      parseString(xml_str, { trim: true }, (err, parsed_data) => {
        let parsed_listings = [];

        parsed_data["Listings"]["Listing"].forEach((listing) => {
          let parsed = parse_listing(listing);
          parsed_listings.push(parsed);
        });

        // check if file exists
        if (!fs.existsSync(file_path)) {
          saveFile(parsed_listings);

          update_db(parsed_listings);
        } else {
          let file_data = fs.readFileSync(file_path, "utf8");

          let old_listings = JSON.parse(file_data);

          saveFile(parsed_listings);

          let upsert_listing = compare(old_listings, parsed_listings);

          console.log(`total update : ${upsert_listing.length}`);

          update_db(upsert_listing);
        }
      });
    });
}

function compare(old_listings, new_listings) {
  let upsert = [];

  let old_listing_dict = {};

  old_listings.forEach((item) => {
    old_listing_dict[item["Property_Ref_No"]] = item;
  });

  new_listings.forEach((new_item) => {
    try {
      let old_listing = old_listing_dict[new_item["Property_Ref_No"]];

      if (JSON.stringify(new_item) == JSON.stringify(old_listing)) {
        console.log(`No Change : ${new_item["Property_Ref_No"]}`);
      } else {
        console.log(`Changed : ${new_item["Property_Ref_No"]}`);

        upsert.push({ event: "update", data: new_item });
      }
    } catch (err) {
      upsert.push({ event: "insert", data: new_item });
    }
  });

  return upsert;
}

function update_db(listings) {
  let api_key = "Bearer f7aa35d133655555be580f3621c927a6cfa89c506c6af3669fd8ec0907da0265de09dca6fa0d532482e1cbd62578615450390ce799e75142cdd71ce4378ccdd170171422b864c9f80cae7e190564e3fe3fcd4de8ee80a2afe27ea8e983e0a86e4045c6cdbebf86b1635f1af73128e3e580067411e5b5f71faa092e8f5eb1b3c1";
  let url = "https://driven-properties-strapi.herokuapp.com/api/listings";

  listings.forEach((item) => {
    let method_ = null;
    if (item.event == "update") {
      method_ = "PUT";
    } else {
      method_ = "POST";
    }
    
    axios({
      method: method_,
      url: url,
      data: {data:item},
      headers: {
        "Authorization": api_key,
        "Content-Type":"application/json"

      },
    })
      .then((resp) => {
        if(resp.status == 200)
        {
            console.log(resp.status)
        }
        else{
            console.log(resp)
        }
      })
      .catch(function (error) {
        console.log(error.response);
      });
  });
}
function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
function saveFile(parsed_listings) {
  fs.writeFile(file_path, JSON.stringify(parsed_listings), (err) => {
    if (err) {
      console.log(`error : ${err}`);
    } else {
      console.log(`file saved : ${file_path}`);
    }
  });
}

function parse_listing(listing) {
  let temp = {};

  for (const [key, v] of Object.entries(listing)) {
    let value = v[0];

    if (key == "Listing_Date" || key == "Last_Updated") {
      temp[key] = new Date(value);
    } else if (key == "Images") {
      let images = [];
      try {
        value["image"].forEach((image) => {
          images.push(image);
        });
      } catch (err) {
        console.log(`images : ${err}`);
      }

      temp[key] = images;
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

  return temp;
}
